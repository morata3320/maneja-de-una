import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

// Cliente gRPC OFICIAL: inventory.InventoryStockService.PushStockUpdate.
// No modifica el contrato Protobuf; almacena reintentos en PostgreSQL.
export class StockRelay {
  constructor(pool,node,address,tls){
    this.pool=pool;this.node=node;this.address=address;this.tls=tls;this.busy=false;
    this.enabled=!!address&&process.env.STOCK_SYNC_ENABLED==='true';
    if(this.enabled){
      const grpc=require('@grpc/grpc-js');
      const loader=require('@grpc/proto-loader');
      const protoPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../inventory.proto');
      const definition=loader.loadSync(protoPath,{keepCase:true,longs:String,enums:String,defaults:true,oneofs:true});
      const proto=grpc.loadPackageDefinition(definition);
      this.grpc=grpc;
      this.client=new proto.inventory.InventoryStockService(address,tls?grpc.credentials.createSsl():grpc.credentials.createInsecure());
    }
  }
  async sweep(){
    if(!this.enabled||this.busy)return 0;
    this.busy=true;let count=0;const db=await this.pool.connect();
    try {
      // Una transacción de outbox protege de workers locales concurrentes.
      for(let i=0;i<50;i++){
        await db.query('BEGIN');
        try{
          const r=await db.query(`SELECT * FROM booking.stock_sync_outbox WHERE acknowledged_at IS NULL
            ORDER BY seq LIMIT 1 FOR UPDATE SKIP LOCKED`);
          if(!r.rows.length){await db.query('COMMIT');break;}
          const x=r.rows[0];
          const msg={service_id:x.service_id,item_id:x.item_id,date:x.date,time_slot:x.time_slot,
            available_units:x.available_units,timestamp:String(x.event_timestamp),slot_id:x.slot_id};
          try{
            const ack=await this.send(msg);
            if(!ack.success || ack.error_code!=='OK')throw Error(`Booking rechazó stock: ${ack.error_code??'UNKNOWN'} ${ack.message??''}`);
            await db.query('UPDATE booking.stock_sync_outbox SET acknowledged_at=now(),last_error=NULL WHERE seq=$1',[x.seq]);
            count++;
          }catch(e){
            await db.query('UPDATE booking.stock_sync_outbox SET attempts=attempts+1,last_error=$2 WHERE seq=$1',[x.seq,String(e.message).slice(0,400)]);
            console.error(JSON.stringify({level:'warn',event:'stock_sync_retry',item_id:x.item_id,error:e.message}));
            await db.query('COMMIT');break;
          }
          await db.query('COMMIT');
        }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
      }
    }catch(e){console.error('Stock relay:',e.message);}finally{db.release();this.busy=false;}
    return count;
  }
  send(msg){return new Promise((resolve,reject)=>{
    const deadline=new Date(Date.now()+4000);
    this.client.PushStockUpdate(msg,{deadline},(err,response)=>err?reject(err):resolve(response));
  });}
}
