import 'dotenv/config';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import pg from 'pg';
import {canonicalRequest,validateOrder,problem,amount,slotId,fingerprint,locator,stateMap} from './domain.mjs';
import {StockRelay} from './stock-relay.mjs';

const config={
  port:Number(process.env.PORT??3100), host:process.env.HOST??'0.0.0.0',
  node:process.env.AUTOS_NODE_ID??'maneja-de-una', name:process.env.AUTOS_NODE_NAME??'MANEJA DE UNA',
  apiKey:process.env.BOOKING_API_KEY??'', adminKey:process.env.ADMIN_API_KEY??''
};
const isLocal=(process.env.DB_HOST??'127.0.0.1').toLowerCase();
if (!['localhost','127.0.0.1','::1'].includes(isLocal) && process.env.ALLOW_NONLOCAL_DATABASE!=='true') {
  throw Error('Este kit no debe apuntar a Azure/producción: configura DB_HOST=127.0.0.1.');
}
if (!config.apiKey || config.apiKey.length<32 || !config.adminKey || config.adminKey.length<32 || config.apiKey===config.adminKey) {
  throw Error('Configura BOOKING_API_KEY y ADMIN_API_KEY diferentes, de al menos 32 caracteres cada una.');
}
const pool=new pg.Pool({host:isLocal,port:Number(process.env.DB_PORT??15432),user:process.env.DB_USER??'maneja_de_una',password:process.env.DB_PASSWORD,database:process.env.DB_NAME??'maneja_de_una',ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:false,max:12});
const relay=new StockRelay(pool,config.node,process.env.BOOKING_GRPC_ADDR??'',process.env.BOOKING_GRPC_TLS==='true');
const port=Number(config.port);
const round=v=>Math.round(Number(v)*100)/100;
const result=(status,body,headers={})=>({status,body,headers});
const q=(sql,args=[])=>pool.query(sql,args);
const requireApi=req=>{if(req.headers['x-api-key']!==config.apiKey && req.headers['x-admin-key']!==config.adminKey) throw {status:401,code:'UNAUTHORIZED',detail:'Falta X-API-Key válido.'};};
const requireAdmin=req=>{if(req.headers['x-admin-key']!==config.adminKey) throw {status:403,code:'FORBIDDEN',detail:'Se requiere X-Admin-Key válido.'};};
const needIdempotency=req=>{const k=req.headers['idempotency-key'];if(!k||!/^[-_a-zA-Z0-9]{8,128}$/.test(k)) throw {status:400,code:'MALFORMED_REQUEST',detail:'Se requiere cabecera Idempotency-Key válida.'};return k;};
const event=async(db,type,data,corr)=>{
  await db.query(`INSERT INTO booking.outbox_events(event_id,type,correlation_id,data) VALUES($1,$2,$3,$4::jsonb)`,
    ['evt-'+randomUUID(),`ec.edu.epn.booking.autos.${type}`,corr,JSON.stringify(data)]);
};
const audit=async(db,action,details,corr)=>{
  await db.query(`INSERT INTO booking.bridge_audit(correlation_id,action,details) VALUES($1,$2,$3::jsonb)`,[corr,action,JSON.stringify(details)]);
};
const slotOf=(v,date,time)=>slotId(v,date,time);
const stock=async(db,vehicleId,date,time,available)=>{
  const t=Math.max(Date.now(),1);
  const r=await db.query(`INSERT INTO booking.stock_sync_monotonic(service_id,item_id,date,time_slot,last_timestamp)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT(service_id,item_id,date,time_slot) DO UPDATE
 SET last_timestamp=GREATEST(booking.stock_sync_monotonic.last_timestamp+1,EXCLUDED.last_timestamp)
 RETURNING last_timestamp`,[config.node,vehicleId,date,time,t]);
  await db.query(`INSERT INTO booking.stock_sync_outbox(service_id,item_id,date,time_slot,slot_id,available_units,event_timestamp)
 VALUES($1,$2,$3,$4,$5,$6,$7)`,[config.node,vehicleId,date,time,slotOf(vehicleId,date,time),available?1:0,r.rows[0].last_timestamp]);
};
const serial=async fn=>{
  const db=await pool.connect();
  try {await db.query('BEGIN');const data=await fn(db);await db.query('COMMIT');return data;}
  catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
  finally{db.release();}
};
const getVehicle=async(db,id,lock=false)=>{
  const {rows}=await db.query(`SELECT v.*,s.name supplier_name,d.name depot_name,d.airport
 FROM catalog.vehicles v LEFT JOIN catalog.suppliers s ON s.supplier_id=v.supplier_id
 LEFT JOIN catalog.depots d ON d.depot_id=v.depot_id WHERE v.vehicle_id=$1${lock?' FOR UPDATE OF v':''}`,[id]);
  if(!rows[0]) throw {status:404,code:'NOT_FOUND',detail:`No existe vehículo ${id}.`};
  return rows[0];
};
const fmtVehicle=v=>({vehicle_id:v.vehicle_id,auto_id:v.vehicle_id,id:v.vehicle_id,
 brand:v.make,model:v.model,marca:v.make,modelo:v.model,category:v.car_type,categoria:v.car_type,
 daily_price:round(v.price_per_day),precio_diario:round(v.price_per_day),currency:'USD',moneda:'USD',
 transmission:v.transmission,transmision:v.transmission,seats:v.seats,asientos:v.seats,doors:v.doors,puertas:v.doors,
 state:v.status,status:stateMap[v.status],estado:stateMap[v.status],air_conditioning:true,unlimited_mileage:true,
 fuel_policy:'LLENO_A_LLENO',free_cancellation:true,photo_url:v.image_url,foto_url:v.image_url,
 proveedor:{nombre:v.supplier_name??config.name,ubicacion:v.depot_name??''},
 kilometraje_actual:v.odometer_km,proximo_mantenimiento_km:v.next_maintenance_km,
 mantenimiento_requerido:Number(v.odometer_km)>=Number(v.next_maintenance_km),
 cleaning_cooldown:{active:v.status==='CLEANING',available_from:v.available_from??null}});
const formatOrder=o=>({order_id:o.id,pnr:o.locator,status:o.status==='CONFIRMED'?'RESERVADO':o.status,
 vehicle_id:o.vehicle_details?.vehicle_id??'',auto_id:o.vehicle_details?.vehicle_id??'',
 voucher_qr_payload:`BOOKING-CAR-${o.locator}`,voucher_qr_data:`BOOKING-CAR-${o.locator}`,
 total_price:{currency:o.currency,total:round(o.total_price)},coverage_type:o.coverage_type,
 created_at:o.creation_date,refund:o.refund??null});
const findOrder=async(db,id,lock=false)=>{
  const {rows}=await db.query(`SELECT * FROM booking.orders WHERE id::text=$1 OR locator=$1 ${lock?'FOR UPDATE':''}`,[id]);
  if(!rows[0]) throw {status:404,code:'NOT_FOUND',detail:'Reserva no encontrada.'};return rows[0];
};
const nowSlot=()=>{
  const local=new Date(Date.now()-5*3600000);
  const s=local.toISOString();const half=Math.floor(local.getUTCMinutes()/30)*30;
  return {date:s.slice(0,10),time:s.slice(11,13)+':'+String(half).padStart(2,'0')};
};
async function progressCleaning(){
  const rows=await q(`SELECT vehicle_id FROM catalog.vehicles WHERE status='CLEANING' AND available_from<=now() LIMIT 100`);
  for (const {vehicle_id} of rows.rows) await serial(async db=>{
    const v=await getVehicle(db,vehicle_id,true);
    if(v.status!=='CLEANING'||!v.available_from||new Date(v.available_from)>new Date())return;
    const newState=Number(v.odometer_km)>=Number(v.next_maintenance_km)?'MAINTENANCE':'AVAILABLE';
    await db.query('UPDATE catalog.vehicles SET status=$2,available_from=NULL WHERE vehicle_id=$1',[vehicle_id,newState]);
    const at=nowSlot(); await stock(db,vehicle_id,at.date,at.time,newState==='AVAILABLE');
    await event(db,newState==='AVAILABLE'?'cooldown.finished':'maintenance.alert',{vehicle_id,state:newState},'system');
  });
}
async function listCars(search={},onlyAvailable=true){
  const {rows}=await q(`SELECT v.*,s.name supplier_name,d.name depot_name,d.airport
 FROM catalog.vehicles v LEFT JOIN catalog.suppliers s ON s.supplier_id=v.supplier_id
 LEFT JOIN catalog.depots d ON d.depot_id=v.depot_id
 WHERE ($1::boolean=false OR v.status='AVAILABLE')
 AND ($2::text='' OR UPPER(v.car_type) LIKE '%'||UPPER($2)||'%')
 AND ($3::text='' OR UPPER(v.transmission) LIKE '%'||UPPER($3)||'%')
 AND ($4::text='' OR d.name ILIKE '%'||$4||'%' OR d.airport ILIKE '%'||$4||'%')
 ORDER BY v.vehicle_id LIMIT $5`,[onlyAvailable,search.category==='ALL'?'':search.category??'',search.transmission==='ALL'?'':search.transmission??'',search.location??'',Math.min(200,Math.max(1,Number(search.limit??100)))]);
  return rows.map(fmtVehicle);
}
async function reserve(req,body,corr){
  requireApi(req);const key=needIdempotency(req),o=canonicalRequest(body);
  const bad=validateOrder(o);if(bad)throw bad;
  const hash=fingerprint(o);
  return await serial(async db=>{
    const ins=await db.query(`INSERT INTO booking.integration_idempotency(idempotency_key,request_sha256,response_json)
 VALUES($1,$2,'{}') ON CONFLICT DO NOTHING RETURNING idempotency_key`,[key,hash]);
    if(!ins.rowCount){
      const old=await db.query('SELECT request_sha256,response_json FROM booking.integration_idempotency WHERE idempotency_key=$1',[key]);
      if(old.rows[0]?.request_sha256!==hash)throw {status:400,code:'IDEMPOTENCY_CONFLICT',detail:'La clave ya se usó con otro cuerpo.'};
      return result(201,old.rows[0].response_json,{'Idempotent-Replay':'true'});
    }
    const v=await getVehicle(db,o.vehicle_id,true);
    if(v.status!=='AVAILABLE') throw {status:409,code:'VEHICLE_UNAVAILABLE',detail:v.status==='CLEANING'?'Vehículo en limpieza obligatoria de 120 minutos.':'Vehículo reservado, entregado o en mantenimiento.'};
    if(o.driver.age<Number(v.min_driver_age??18))throw {status:422,code:'DRIVER_UNDERAGE',detail:'No cumple edad mínima del vehículo.'};
    const price=amount(v,o),id=randomUUID(),pnr=locator();
    const vehicleDetails={vehicle_id:v.vehicle_id,make:v.make,model:v.model,price_per_day:round(v.price_per_day)};
    const routeDetails={pickup:{date:o.pickup_date,time:o.pickup_time,location:o.pickup_location},dropoff:{date:o.dropoff_date,time:o.dropoff_time,location:o.dropoff_location}};
    const {rows}=await db.query(`INSERT INTO booking.orders(id,locator,status,vehicle_details,route_details,driver_details,total_price,currency,coverage_type,deposit,pricing)
      VALUES($1,$2,'CONFIRMED',$3::jsonb,$4::jsonb,$5::jsonb,$6,'USD',$7,$8,$9::jsonb) RETURNING *`,
      [id,pnr,JSON.stringify(vehicleDetails),JSON.stringify(routeDetails),JSON.stringify(o.driver),price.total,
        o.coverage_type==='TOTAL'||o.coverage_type==='PREMIUM'?'TOTAL':'BASICA',o.coverage_type==='TOTAL'?0:1200,JSON.stringify(price)]);
    await db.query("UPDATE catalog.vehicles SET status='RESERVED' WHERE vehicle_id=$1",[v.vehicle_id]);
    const response=formatOrder(rows[0]);
    await db.query('UPDATE booking.integration_idempotency SET response_json=$2::jsonb WHERE idempotency_key=$1',[key,JSON.stringify(response)]);
    await event(db,'order.confirmed',{order_id:id,pnr,vehicle_id:v.vehicle_id,total_price:price.total},corr);
    await stock(db,v.vehicle_id,o.pickup_date,o.pickup_time,false);
    await audit(db,'reserve',{id,vehicle_id:v.vehicle_id},corr);
    return result(201,response);
  });
}
async function changeOrder(type,id,req,body,corr){
  requireApi(req);needIdempotency(req);
  return serial(async db=>{
    const order=await findOrder(db,id,true),vid=order.vehicle_details.vehicle_id;
    const v=await getVehicle(db,vid,true);
    if(type==='cancel'){
      if(order.status==='CANCELLED')return result(200,{...formatOrder(order),status:'CANCELLED'});
      if(order.status!=='CONFIRMED')throw {status:409,code:'VEHICLE_UNAVAILABLE',detail:'No se puede cancelar una renta entregada o completada.'};
      const mock={refund_id:'REF-AUTO-'+randomUUID().slice(0,8),amount:round(order.total_price),currency:'USD',percentage:100,status:'SIMULATED'};
      const {rows}=await db.query("UPDATE booking.orders SET status='CANCELLED',refund=$2::jsonb WHERE id=$1 RETURNING *",[order.id,JSON.stringify(mock)]);
      await db.query("UPDATE catalog.vehicles SET status='AVAILABLE' WHERE vehicle_id=$1 AND status='RESERVED'",[vid]);
      await stock(db,vid,order.route_details.pickup.date,order.route_details.pickup.time,true);
      await event(db,'order.cancelled',{order_id:order.id,vehicle_id:vid,refund_status:'SIMULATED'},corr);
      await audit(db,'cancel',{order_id:order.id,refund_status:'SIMULATED'},corr);
      return result(200,{...formatOrder(rows[0]),status:'CANCELLED',refund:mock,inventory_restoration:{status:'RESTORED',vehicle_id:vid,new_state:'DISPONIBLE'}});
    }
    if(type==='digital'){
      if(order.status!=='CONFIRMED'||!['RESERVED','READY_FOR_DELIVERY'].includes(v.status))throw {status:409,code:'VEHICLE_UNAVAILABLE',detail:'Check-in no permitido en este estado.'};
      if(!body?.documento_identidad)throw {status:400,code:'MALFORMED_REQUEST',detail:'Falta documento_identidad.'};
      if(body.fecha_vencimiento_licencia && body.fecha_vencimiento_licencia<new Date().toISOString().slice(0,10))throw {status:422,code:'INVALID_PAYLOAD',detail:'Licencia vencida.'};
      await db.query('UPDATE booking.orders SET checkin_at=COALESCE(checkin_at,now()) WHERE id=$1',[order.id]);
      await db.query("UPDATE catalog.vehicles SET status='READY_FOR_DELIVERY' WHERE vehicle_id=$1",[vid]);
      return result(200,{pnr:order.locator,checkin_status:'CHECKIN_COMPLETED',fast_track_pickup:true,voucher_qr_data:`AUTOS-CHECKIN-${order.locator}-VERIFIED`});
    }
    if(type==='deliver'){
      if(order.status!=='CONFIRMED'||!['RESERVED','READY_FOR_DELIVERY'].includes(v.status))throw {status:409,code:'VEHICLE_UNAVAILABLE',detail:'No puede entregarse en este estado.'};
      if(!body.licencia_conducir||!Number.isInteger(body.km_salida)||body.km_salida<Number(v.odometer_km))throw {status:422,code:'INVALID_PAYLOAD',detail:'Falta licencia o km_salida menor que el odómetro.'};
      if(order.driver_details?.license_number!==String(body.licencia_conducir))throw {status:422,code:'INVALID_PAYLOAD',detail:'Licencia distinta de la registrada.'};
      await db.query("UPDATE catalog.vehicles SET status='DELIVERED',odometer_km=$2 WHERE vehicle_id=$1",[vid,body.km_salida]);
      await db.query("UPDATE booking.orders SET status='DELIVERED',km_salida=$2,delivered_at=now() WHERE id=$1",[order.id,body.km_salida]);
      await event(db,'order.delivered',{order_id:order.id,vehicle_id:vid,km_salida:body.km_salida},corr);
      return result(200,{success:true,order_id:order.id,pnr:order.locator,estado_orden:'ENTREGADO',km_salida:body.km_salida});
    }
    if(type==='return'){
      if(order.status!=='DELIVERED'||v.status!=='DELIVERED')throw {status:409,code:'VEHICLE_UNAVAILABLE',detail:'Solo pueden devolverse órdenes ENTREGADO.'};
      if(!Number.isInteger(body.km_retorno)||body.km_retorno<Number(order.km_salida))throw {status:422,code:'INVALID_PAYLOAD',detail:'km_retorno debe ser >= km_salida.'};
      const availableFrom=new Date(Date.now()+120*60000);
      await db.query("UPDATE catalog.vehicles SET status='CLEANING',odometer_km=$2,available_from=$3 WHERE vehicle_id=$1",[vid,body.km_retorno,availableFrom]);
      await db.query("UPDATE booking.orders SET status='COMPLETED',km_retorno=$2,returned_at=now() WHERE id=$1",[order.id,body.km_retorno]);
      const at=nowSlot();await stock(db,vid,at.date,at.time,false);
      await event(db,'cooldown.started',{vehicle_id:vid,available_from:availableFrom.toISOString(),cooldown_minutes:120},corr);
      if(body.km_retorno>=Number(v.next_maintenance_km))await event(db,'mantenimiento.alerta',{vehicle_id:vid,km:body.km_retorno},corr);
      await audit(db,'return',{order_id:order.id,vehicle_id:vid,km_retorno:body.km_retorno},corr);
      return result(200,{success:true,order_id:order.id,pnr:order.locator,estado_orden:'COMPLETADA',km_retorno:body.km_retorno,km_recorridos:body.km_retorno-order.km_salida,
        cooldown:{auto_id:vid,estado:'EN_LIMPIEZA',cooldown_horas:2,disponible_desde:availableFrom.toISOString()},alerta_mantenimiento:body.km_retorno>=Number(v.next_maintenance_km)});
    }
  });
}
async function handle(req,url,body,corr){
  let p=url.pathname;
  if(p.startsWith('/api/v3/'))p=p.slice('/api/v3'.length);
  else if(p==='/api/v3')p='/';
  // También se acepta POST /reservas por la divergencia documentada en la guía.
  if(p==='/reservas')p='/autos/reservas';
  const method=req.method;
  if(method==='GET'&&p==='/autos/health'){
    const st=await q('SELECT count(*)::int n FROM catalog.vehicles');
    return result(200,{status:'HEALTHY',nodo_id:config.node,nombre_proveedor:config.name,vertical:'AUTOS',version:'3.0.0',total_vehiculos:st.rows[0].n,timestamp:new Date().toISOString()});
  }
  if(method==='GET'&&p==='/autos'){
    const cars=await listCars({category:url.searchParams.get('category')??'',transmission:url.searchParams.get('transmission')??'',limit:url.searchParams.get('limit')??100});
    return result(200,{total:cars.length,limit:Number(url.searchParams.get('limit')??100),data:cars});
  }
  if(method==='POST'&&p==='/autos/search'){
    const o=body??{};const pseudo={pickup_date:o.pickup_date,pickup_time:o.pickup_time,dropoff_date:o.dropoff_date,dropoff_time:o.dropoff_time};
    try {const {rentalDays}=await import('./domain.mjs');rentalDays(pseudo);}catch(e){throw {status:422,code:'INVALID_DATES',detail:e.message};}
    const location=String(o.pickup_location??'');
    const airport=(location.match(/\b(UIO|GYE|CUE)\b/i)??[])[1];
    const searchLocation=airport??(location.match(/Quito|Guayaquil|Cuenca/i)??[])[0]??location;
    const cars=await listCars({category:o.category,transmission:o.transmission,location:searchLocation});
    return result(200,{request_id:randomUUID(),metadata:{total_results:cars.length,surcharge_applied:o.driver_age<25||o.driver_age>70,surcharge_amount:0,pickup_location:o.pickup_location,pickup_date:o.pickup_date,dropoff_date:o.dropoff_date},data:cars});
  }
  if(method==='GET'&&p==='/autos/flota'){
    const cars=await listCars({},false);
    return result(200,cars.map(c=>({...c,estado_operativo:c.status,cooldown_activo:c.state==='CLEANING'})));
  }
  if(method==='GET'&&p==='/autos/promociones/contrato'){
    requireApi(req);const r=await q('SELECT * FROM booking.promo_contract WHERE id=1');const x=r.rows[0];
    if(!x)throw {status:404,code:'NOT_FOUND',detail:'Sin acuerdo de promociones.'};
    return result(200,{proveedor_codigo:config.node,nombre_socio:config.name,vertical:'AUTOS',permite_promociones:x.allows_promotions,porcentaje_descuento_maximo:round(x.max_discount_percentage),destinos_habilitados:x.enabled_destinations,vigencia_hasta:x.valid_until,condiciones_combo:x.combo_conditions});
  }
  if(method==='PUT'&&p==='/autos/promociones/contrato'){
    requireAdmin(req);needIdempotency(req);
    if(typeof body?.permite_promociones!=='boolean'||!Number.isFinite(body.porcentaje_descuento_maximo)||body.porcentaje_descuento_maximo<0||body.porcentaje_descuento_maximo>100)throw {status:400,code:'INVALID_PAYLOAD',detail:'Convenio inválido.'};
    await q(`INSERT INTO booking.promo_contract(id,allows_promotions,max_discount_percentage,enabled_destinations,valid_until,combo_conditions)
    VALUES(1,$1,$2,$3::jsonb,$4,$5) ON CONFLICT(id) DO UPDATE SET allows_promotions=$1,max_discount_percentage=$2,enabled_destinations=$3::jsonb,valid_until=$4,combo_conditions=$5`,
      [body.permite_promociones,body.porcentaje_descuento_maximo,JSON.stringify(body.destinos_habilitados??[]),body.vigencia_hasta??null,body.condiciones_combo??null]);
    return result(200,{success:true,mensaje:'Acuerdo actualizado'});
  }
  if(method==='GET'&&p==='/autos/eventos'){
    requireApi(req);const after=Number(url.searchParams.get('after')??0)||0,limit=Math.min(100,Number(url.searchParams.get('limit')??10));
    const r=await q('SELECT event_id,type,correlation_id,data,time FROM booking.outbox_events WHERE seq>$1 ORDER BY seq LIMIT $2',[after,limit]);
    return result(200,{events:r.rows.map(x=>({specversion:'1.0',id:x.event_id,type:x.type,source:'/microservices/ms-autos',time:x.time,correlation_id:x.correlation_id,data:x.data})),metadata:{total:r.rows.length,timestamp:new Date().toISOString()}});
  }
  if(method==='GET'&&p==='/autos/orders'){
    requireApi(req);const r=await q('SELECT * FROM booking.orders ORDER BY creation_date DESC LIMIT 100');return result(200,r.rows.map(formatOrder));
  }
  if(method==='POST'&&['/autos/orders/create','/autos/reservas'].includes(p))return reserve(req,body,corr);
  if(method==='POST'&&p==='/internal/sync-stock'){
    requireAdmin(req);
    const date=String(body?.date??''),time=String(body?.time_slot??'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):(00|30)$/.test(time))throw {status:422,code:'INVALID_DATES',detail:'Indica date YYYY-MM-DD y time_slot HH:00/HH:30.'};
    const r=await serial(async db=>{
      const list=await db.query('SELECT vehicle_id,status FROM catalog.vehicles');
      for(const x of list.rows)await stock(db,x.vehicle_id,date,time,x.status==='AVAILABLE');
      return list.rowCount;
    });
    void relay.sweep();return result(202,{queued:r,date,time_slot:time,grpc_enabled:relay.enabled});
  }
  const checkin=p.match(/^\/autos\/reservas\/([^/]+)\/checkin$/);
  if(method==='POST'&&checkin)return changeOrder('digital',decodeURIComponent(checkin[1]),req,body,corr);
  const orderOp=p.match(/^\/autos\/orders\/([^/]+)\/(checkin-entrega|checkin-devolucion|cancel)$/);
  if(method==='POST'&&orderOp)return changeOrder({'checkin-entrega':'deliver','checkin-devolucion':'return',cancel:'cancel'}[orderOp[2]],decodeURIComponent(orderOp[1]),req,body,corr);
  const orderOne=p.match(/^\/autos\/orders\/([^/]+)$/);
  if(method==='GET'&&orderOne){requireApi(req);return result(200,formatOrder(await findOrder(pool,decodeURIComponent(orderOne[1]))));}
  const covers=p.match(/^\/autos\/([^/]+)\/coberturas$/);
  if(method==='GET'&&covers){const v=await getVehicle(pool,decodeURIComponent(covers[1]));return result(200,{auto_id:v.vehicle_id,vehiculo:`${v.make} ${v.model}`,opciones:[
    {tipo:'BASICA',nombre:'Cobertura Básica',costo_adicional_diario:0,franquicia:1200,deposito_garantia:1200},
    {tipo:'TOTAL',nombre:'Cobertura Total',costo_adicional_diario:18,franquicia:0,deposito_garantia:0}]});}
  const maintenance=p.match(/^\/autos\/([^/]+)\/mantenimiento\/registro$/);
  if(method==='POST'&&maintenance){
    requireAdmin(req);needIdempotency(req);const id=decodeURIComponent(maintenance[1]);
    if(!Number.isInteger(body?.kilometraje_registrado)||!Number.isInteger(body?.nivel_combustible)||!body?.tecnico_id)throw {status:400,code:'INVALID_PAYLOAD',detail:'Faltan técnico, km o combustible.'};
    return serial(async db=>{
      const v=await getVehicle(db,id,true);
      if(body.kilometraje_registrado<Number(v.odometer_km))throw {status:422,code:'INVALID_PAYLOAD',detail:'No puede retroceder odómetro.'};
      const next=body.mantenimiento_realizado&&Number.isInteger(body.nuevo_proximo_mantenimiento_km)?body.nuevo_proximo_mantenimiento_km:v.next_maintenance_km;
      const alert=body.kilometraje_registrado>=Number(next);
      const state=alert?'MAINTENANCE':v.status==='MAINTENANCE'&&body.mantenimiento_realizado?'AVAILABLE':v.status;
      const rr=await db.query(`INSERT INTO catalog.maintenance_log(vehicle_id,technician_id,odometer_km,fuel_level,body_condition,tires_condition,notes,maintenance_done,alert)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
       [id,body.tecnico_id,body.kilometraje_registrado,body.nivel_combustible,body.condiciones_carroceria??null,body.estado_neumaticos??null,body.observaciones??null,!!body.mantenimiento_realizado,alert]);
      await db.query('UPDATE catalog.vehicles SET odometer_km=$2,next_maintenance_km=$3,status=$4 WHERE vehicle_id=$1',[id,body.kilometraje_registrado,next,state]);
      const at=nowSlot();await stock(db,id,at.date,at.time,state==='AVAILABLE');
      if(alert)await event(db,'mantenimiento.alerta',{vehicle_id:id,odometer_km:body.kilometraje_registrado},corr);
      await audit(db,'maintenance',{vehicle_id:id,alert,technician_id:body.tecnico_id},corr);
      return result(200,{auto_id:id,bitacora_id:`BIT-AUTO-${rr.rows[0].id}`,kilometraje_actual:body.kilometraje_registrado,proximo_mantenimiento_km:next,mantenimiento_requerido:alert,timestamp:new Date().toISOString()});
    });
  }
  const returnDirect=p.match(/^\/autos\/([^/]+)\/devolucion$/);
  if(method==='POST'&&returnDirect){
    requireAdmin(req);needIdempotency(req);const vid=decodeURIComponent(returnDirect[1]);
    return serial(async db=>{
      const v=await getVehicle(db,vid,true);
      if(!['DELIVERED','READY_FOR_DELIVERY'].includes(v.status))throw {status:409,code:'VEHICLE_UNAVAILABLE',detail:'No se puede devolver este vehículo.'};
      const date=new Date(Date.now()+7200000);await db.query("UPDATE catalog.vehicles SET status='CLEANING',available_from=$2 WHERE vehicle_id=$1",[vid,date]);
      const at=nowSlot();await stock(db,vid,at.date,at.time,false);
      await event(db,'cooldown.started',{vehicle_id:vid,cooldown_minutes:120},corr);
      return result(200,{auto_id:vid,estado:'EN_LIMPIEZA',cooldown_horas:2,disponible_desde:date.toISOString()});
    });
  }
  const vehicleOne=p.match(/^\/autos\/([^/]+)$/);
  if(method==='GET'&&vehicleOne)return result(200,fmtVehicle(await getVehicle(pool,decodeURIComponent(vehicleOne[1]))));
  throw {status:404,code:'NOT_FOUND',detail:`Ruta ${method} ${p} no encontrada.`};
}
async function readBody(req){let s='';for await(const c of req){s+=c;if(s.length>1_000_000)throw {status:413,code:'PAYLOAD_TOO_LARGE',detail:'Cuerpo demasiado grande.'};}if(!s.trim())return {};try{return JSON.parse(s);}catch{throw {status:400,code:'MALFORMED_REQUEST',detail:'JSON inválido.'};}}
const app=http.createServer(async(req,res)=>{
  const corr=String(req.headers['x-correlation-id']??randomUUID());
  const base='http://localhost';const url=new URL(req.url,base);
  res.setHeader('X-Correlation-Id',corr);
  const origin=req.headers.origin;
  if(origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Headers','Content-Type,Idempotency-Key,X-API-Key,X-Correlation-Id,X-Admin-Key');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');
  }
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  try{
    if(req.method==='POST'||req.method==='PUT'){
      const type=(req.headers['content-type']??'').split(';')[0].trim();
      if(type!=='application/json')throw {status:400,code:'MALFORMED_REQUEST',detail:'Content-Type debe ser application/json.'};
    }
    const body=(req.method==='POST'||req.method==='PUT')?await readBody(req):{};
    const out=await handle(req,url,body,corr);
    res.writeHead(out.status,{'Content-Type':'application/json; charset=utf-8',...(out.headers??{})});res.end(JSON.stringify(out.body));
    if(req.method==='POST'||req.method==='PUT')void relay.sweep();
  }catch(e){
    const status=Number(e.status??503);
    const code=e.code??'INTERNAL_ERROR';
    const detail=e.status?e.detail:'El servicio no pudo completar la solicitud.';
    if(!e.status)console.error(JSON.stringify({level:'error',correlation_id:corr,message:e.message}));
    const p=problem(status,code,detail,url.pathname);res.writeHead(status,{'Content-Type':'application/problem+json; charset=utf-8'});res.end(JSON.stringify(p));
  }
});
const start=async()=>{
  await pool.query('SELECT 1 FROM catalog.vehicles LIMIT 1');
  app.listen(port,config.host,()=>console.log(`MANEJA DE UNA V3 bridge: http://${config.host}:${port}/api/v3/autos/health | node=${config.node}`));
  setInterval(()=>void progressCleaning().catch(e=>console.error('cooldown',e.message)),10000).unref();
  if(relay.enabled){setInterval(()=>void relay.sweep(),Number(process.env.STOCK_SYNC_INTERVAL_MS??5000)).unref();void relay.sweep();}
};
start().catch(e=>{console.error('Fallo al iniciar: revisa SQL maestro, .env y PostgreSQL local:',e.message);process.exitCode=1;pool.end();});
