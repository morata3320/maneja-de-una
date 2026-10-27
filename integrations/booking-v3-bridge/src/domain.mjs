import { createHash, randomUUID } from 'node:crypto';

export function canonicalRequest(body) {
  const o = body ?? {};
  const d = o.driver ?? o.conductor ?? {};
  return {
    vehicle_id: String(o.vehicle_id ?? o.auto_id ?? ''),
    pickup_date: String(o.pickup_date ?? o.fecha_recogida ?? ''),
    dropoff_date: String(o.dropoff_date ?? o.fecha_devolucion ?? ''),
    pickup_time: String(o.pickup_time ?? o.hora_recogida ?? '10:00'),
    dropoff_time: String(o.dropoff_time ?? o.hora_devolucion ?? '10:00'),
    pickup_location: String(o.pickup_location ?? o.lugar_recogida ?? ''),
    dropoff_location: String(o.dropoff_location ?? o.lugar_devolucion ?? ''),
    coverage_type: String(o.coverage_type ?? o.cobertura ?? 'BASIC').toUpperCase(),
    driver: {
      full_name: String(d.full_name ?? d.nombre ?? ''),
      email: String(d.email ?? d.correo ?? ''),
      phone: String(d.phone ?? d.telefono ?? ''),
      license_number: String(d.license_number ?? d.licencia_conducir ?? ''),
      country_license: String(d.country_license ?? 'Ecuador'),
      age: Number(d.age ?? d.edad),
      flight_number: String(d.flight_number ?? '')
    }
  };
}
export function problem(status, code, detail, instance='/api/v3/autos/reservas') {
  const titles = {400:'Solicitud incorrecta',401:'No autorizado',403:'Prohibido',404:'No encontrado',409:'Vehículo No Disponible',422:'Entidad no procesable',503:'Servicio no disponible'};
  return {type: `https://booking.epn.edu.ec/errors/${status===409?'vehicle-unavailable':code.toLowerCase().replaceAll('_','-')}`,title:titles[status]??'Error',status,detail,code,instance};
}
export function validateOrder(order) {
  const fail=(code,detail)=>({status:422,code,detail});
  if (!order.vehicle_id || !order.driver.full_name || !order.driver.email || !order.driver.phone || !order.driver.license_number || !Number.isFinite(order.driver.age))
    return fail('INVALID_PAYLOAD','Faltan vehicle_id o datos obligatorios de driver.');
  if (order.driver.age < 18) return fail('DRIVER_UNDERAGE','El conductor debe tener al menos 18 años.');
  if (!['BASIC','BASICA','TOTAL','PREMIUM'].includes(order.coverage_type)) return fail('INVALID_PAYLOAD','coverage_type inválido.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(order.driver.email)) return fail('INVALID_PAYLOAD','Email del conductor inválido.');
  try { rentalDays(order); } catch(e) { return fail('INVALID_DATES',e.message); }
  return null;
}
export function rentalDays(o) {
  for(const [date,t] of [[o.pickup_date,o.pickup_time],[o.dropoff_date,o.dropoff_time]]) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):(00|30)$/.test(t)) throw Error('Fechas y horarios deben ser válidos, en franjas de 30 minutos.');
    const [y,m,d]=date.split('-').map(Number);
    const z=new Date(Date.UTC(y,m-1,d));
    if (z.getUTCFullYear()!==y || z.getUTCMonth()!==m-1 || z.getUTCDate()!==d) throw Error('Fecha de calendario inválida.');
  }
  const start=Date.parse(`${o.pickup_date}T${o.pickup_time}:00-05:00`);
  const end=Date.parse(`${o.dropoff_date}T${o.dropoff_time}:00-05:00`);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end) throw Error('La devolución debe ser posterior al retiro.');
  return Math.ceil((end-start)/86400000);
}
export function amount(vehicle,order){
  const days=rentalDays(order);
  const base=Number(vehicle.price_per_day)*days;
  const coverage=order.coverage_type==='TOTAL'||order.coverage_type==='PREMIUM'?18*days:0;
  const young=(order.driver.age<25||order.driver.age>70)?Math.round(base*.1*100)/100:0;
  return {days,base,coverage,young,total:Math.round((base+coverage+young)*100)/100};
}
export function slotId(vehicleId,date,time){return `slot-${vehicleId}-${date.replaceAll('-','')}-${time.replace(':','')}`;}
export function fingerprint(x){return createHash('sha256').update(JSON.stringify(x)).digest('hex');}
export function locator(){return 'CAR'+randomUUID().replaceAll('-','').slice(0,5).toUpperCase();}
export const stateMap={AVAILABLE:'DISPONIBLE',RESERVED:'RESERVADO',READY_FOR_DELIVERY:'LISTO_PARA_ENTREGAR',DELIVERED:'ENTREGADO',CLEANING:'EN_LIMPIEZA',MAINTENANCE:'EN_MANTENIMIENTO'};
