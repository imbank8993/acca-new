const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/keuangan/keuangan.service.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: false } }).outputText;
const clone = value => JSON.parse(JSON.stringify(value));

function fixture(overrides = {}, fail = () => false) {
    let state = { users: [{ id: 1, auth_id: 'owner' }, { id: 2, auth_id: 'other' }], financial_officers: [{ user_id: 1, role_type: 'Bendahara' }], budget_requests: [{ id: 'r', pj_user_id: 2, division_id: 'B', created_at: '2026-10-12', status: 'Antrean Pencairan', total_amount: 100, total_disbursed: 0, budget_request_items: [{ id: 'item', budget_request_id: 'r', category: 'Bahan', quantity: 1, unit_price: 100, total_price: 100, actual_price: null }] }], budget_request_items: [{ id: 'item', budget_request_id: 'r', category: 'Bahan', quantity: 1, unit_price: 100, total_price: 100, actual_price: null }], disbursements: [], approval_logs: [], receipt_submissions: [], file_uploads: [], division_budgets: [{id: 'default-budget', division_id: 'B', period: '2026', category: 'Bahan', initial_budget: 1000, total_budget: 1000}], budget_mutations: [], divisions: [{ id: 'B', name: 'Akademik' }], ...clone(overrides) };
    let serial = Promise.resolve(), sequence = 0, locks = 0;
    function adapter(getState) { return { from(table) {
        const q = { filters: [], op: 'read', payload: null, one: false,
            select(){return this;}, order(){return this;}, eq(k,v){this.filters.push(row=>row[k]===v);return this;}, in(k,v){this.filters.push(row=>v.includes(row[k]));return this;}, single(){this.one=true;return this;}, maybeSingle(){this.one=true;return this;}, update(payload){this.op='update';this.payload=payload;return this;}, insert(payload){this.op='insert';this.payload=payload;return this;}, delete(){this.op='delete';return this;},
            then(resolve,reject){return Promise.resolve().then(()=>{
                if(fail(table,this.op))return {data:null,error:{message:'Injected failure'}};
                const data=getState();const rows=data[table]||(data[table]=[]);let found=rows.filter(row=>this.filters.every(filter=>filter(row)));
                if(this.op==='read' && table==='budget_requests')found=found.map(row=>({...row,budget_request_items:data.budget_request_items.filter(item=>item.budget_request_id===row.id),disbursements:data.disbursements.filter(item=>item.budget_request_id===row.id)}));
                if(this.op==='insert'){found=(Array.isArray(this.payload)?this.payload:[this.payload]).map(row=>({id:`generated-${++sequence}`,...clone(row)}));rows.push(...found);}
                if(this.op==='update')found.forEach(row=>Object.assign(row,clone(this.payload)));
                if(this.op==='delete')data[table]=rows.filter(row=>!found.includes(row));
                return {data:clone(this.one?(found[0]||null):found),error:null,count:found.length};
            }).then(resolve,reject);}
        };return q;
    }}; }
    const prisma = { adapter: adapter(()=>state), async $transaction(work) {
        let release;const previous=serial;serial=new Promise(resolve=>release=resolve);await previous;
        const draft=clone(state);const tx={adapter:adapter(()=>draft),async $executeRaw(strings){assert.match(strings.join(''),/pg_advisory_xact_lock/);locks++;},budget_request_registers:{async deleteMany(){},async createMany(){}}};
        try {const result=await work(tx);state=draft;return result;} finally {release();}
    }};
    const module={exports:{}};
    vm.runInNewContext(compiled,{module,exports:module.exports,console,URL,Intl,Set,require(name){if(name==='@nestjs/common')return {Injectable:()=>value=>value,Logger:class{}};if(name.includes('prisma-db-adapter'))return {createPrismaDbAdapter:client=>client.adapter};if(name.includes('prisma.service'))return {PrismaService:class{}};return require(name);}});
    const service=new module.exports.KeuanganService(prisma);
    async function call(action,body={},userId=1,read=false,query=''){
        const response={code:200,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
        await service[read?'getKeuangan':'postKeuangan']({user:{id:userId,authId:userId===1?'owner':'other',role:'GURU'},headers:{},body:{action,...body},originalUrl:`/keuangan?action=${action}${query}`},response);
        return response;
    }
    return {call,get state(){return state;},get locks(){return locks;}};
}

test('Nominal dan lampiran disembunyikan dari pembaca di luar divisi', async()=>{
    const f=fixture({financial_officers:[]});const response=await f.call('get_requests',{},1,true,'&role_context=semua');
    const row=response.body.data[0];assert.equal(row.total_amount,null);assert.equal(row.budget_request_items[0].total_price,null);assert.equal(row.budget_request_items[0].actual_price,null);assert.equal(row.report_file_url,null);
});
test('Kepala Divisi tidak dapat membaca pencairan divisi lain', async()=>{
    const f=fixture({financial_officers:[{user_id:1,role_type:'Kepala Divisi',division_id:'A'}]});const response=await f.call('get_disbursements',{},1,true,'&request_id=r');assert.equal(response.code,403);
});
test('Dua pencairan bersamaan tidak dapat melampaui nilai pengajuan', async()=>{
    const f=fixture();const body={request_id:'r',amount_to_disburse:80,items:[{id:'item',actual_price:80}]};const responses=await Promise.all([f.call('disburse_request',body),f.call('disburse_request',body)]);
    assert.deepEqual(responses.map(r=>r.code).sort(),[200,409]);assert.equal(f.state.disbursements.length,1);assert.equal(f.state.disbursements[0].amount,80);assert.equal(f.locks,2);
});
test('Nilai item negatif dan total yang tidak cocok ditolak tanpa perubahan', async()=>{
    for(const amount of [-1,50]){const f=fixture();const response=await f.call('disburse_request',{request_id:'r',amount_to_disburse:80,items:[{id:'item',actual_price:amount}]});assert.equal(response.code,400);assert.equal(f.state.disbursements.length,0);assert.equal(f.state.budget_request_items[0].actual_price,null);}
});
test('Kegagalan log membatalkan pencairan dan perubahan item', async()=>{
    const f=fixture({},(table,op)=>table==='approval_logs'&&op==='insert');const response=await f.call('disburse_request',{request_id:'r',amount_to_disburse:80,items:[{id:'item',actual_price:80}]});assert.equal(response.code,500);assert.equal(f.state.disbursements.length,0);assert.equal(f.state.budget_requests[0].status,'Antrean Pencairan');assert.equal(f.state.budget_request_items[0].actual_price,null);
});
test('Transfer mempertimbangkan dana yang sudah dicadangkan', async()=>{
    const f=fixture({division_budgets:[{id:'b',division_id:'B',period:'2026',category:'Bahan',initial_budget:110,total_budget:110}]});const response=await f.call('transfer_budget',{from_division_id:'B',to_division_id:'C',period:'2026',category:'Bahan',amount:50,reason:'uji'});assert.equal(response.code,400);assert.equal(f.state.division_budgets[0].total_budget,110);
});
test('Kegagalan tujuan transfer tidak mengurangi pagu asal', async()=>{
    const f=fixture({budget_requests:[],division_budgets:[{id:'b',division_id:'B',period:'2026',category:'Bahan',initial_budget:110,total_budget:110}]},(table,op)=>table==='division_budgets'&&op==='insert');const response=await f.call('transfer_budget',{from_division_id:'B',to_division_id:'C',period:'2026',category:'Bahan',amount:50,reason:'uji'});assert.equal(response.code,500);assert.equal(f.state.division_budgets[0].total_budget,110);
});
test('Laporan sebelum dana diterima tidak dapat mengubah alur', async()=>{
    const f=fixture();const response=await f.call('upload_report',{request_id:'r',report_url:'https://example.test/report.pdf'},2);assert.equal(response.code,409);assert.equal(f.state.budget_requests[0].status,'Antrean Pencairan');
});
test('Laporan pertama dengan status Belum Ada memulai verifikasi KTU', async()=>{
    const f=fixture({budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Menunggu Laporan PJ',report_status:'Belum Ada',total_amount:100,total_disbursed:100}],file_uploads:[{file_url:'https://example.test/report.pdf',file_name:'report.pdf',folder:'owner:other:laporan_keuangan'}]});const response=await f.call('upload_report',{request_id:'r',report_url:'https://example.test/report.pdf'},2);assert.equal(response.code,200);assert.equal(f.state.budget_requests[0].report_status,'Menunggu KTU');
});
test('Laporan milik orang lain dan URL JavaScript ditolak', async()=>{
    const overrides={budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Menunggu Laporan PJ',report_status:'Belum Ada'}],file_uploads:[{file_url:'https://example.test/report.pdf',file_name:'report.pdf',folder:'owner:owner:laporan_keuangan'}]};
    const f=fixture(overrides);assert.equal((await f.call('upload_report',{request_id:'r',report_url:'https://example.test/report.pdf'},2)).code,403);assert.equal((await f.call('upload_report',{request_id:'r',report_url:'javascript:void(0)'},2)).code,400);
});
test('PPK tidak dapat mengarsipkan laporan yang belum lengkap', async()=>{
    const f=fixture({financial_officers:[{user_id:1,role_type:'PPK'}],budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Proses Laporan',report_status:'Menunggu PPK',report_file_url:'https://example.test/report.pdf',total_amount:100,total_disbursed:100,receipt_status:'Sebagian',report_received_by_bendahara:false}]});const response=await f.call('verify_report',{request_id:'r'});assert.equal(response.code,409);assert.equal(f.state.budget_requests[0].status,'Proses Laporan');
});

test('PPK dapat mengarsipkan laporan setelah seluruh syarat terpenuhi', async()=>{
    const f=fixture({financial_officers:[{user_id:1,role_type:'PPK'}],budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Proses Laporan',report_status:'Menunggu PPK',report_file_url:'https://example.test/report.pdf',total_amount:100,total_disbursed:100,receipt_status:'Disetujui Bendahara',report_received_by_bendahara:true}]});
    assert.equal((await f.call('verify_report',{request_id:'r'})).code,200);assert.equal(f.state.budget_requests[0].status,'Arsip Selesai');assert.equal(f.state.budget_requests[0].report_status,'Selesai');
});

test('Penggantian PDF mengulang verifikasi dan membatalkan tanda terima sebelumnya', async()=>{
    const f=fixture({budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Proses Laporan',report_status:'Menunggu PPK',report_received_by_bendahara:true,total_amount:100,total_disbursed:100}],file_uploads:[{file_url:'https://example.test/new.pdf',file_name:'new.pdf',folder:'owner:other:laporan_keuangan'}]});
    assert.equal((await f.call('upload_report',{request_id:'r',report_url:'https://example.test/new.pdf'},2)).code,200);assert.equal(f.state.budget_requests[0].report_status,'Menunggu KTU');assert.equal(f.state.budget_requests[0].report_received_by_bendahara,false);
});
test('Ringkasan pagu menggunakan realisasi item yang sudah diarsipkan', async()=>{
    const f=fixture({budget_requests:[{id:'r',pj_user_id:2,division_id:'B',created_at:'2026-10-12',status:'Arsip Selesai'}],budget_request_items:[{id:'item',budget_request_id:'r',category:'Bahan',quantity:1,unit_price:100,total_price:100,actual_price:80}],division_budgets:[{id:'b',division_id:'B',period:'2026',category:'Bahan',initial_budget:110,total_budget:110}]});const response=await f.call('get_budgets',{},1,true);assert.equal(response.body.data[0].used_budget,80);assert.equal(response.body.data[0].remaining_budget,30);assert(source.includes('budget_request_items(category, total_price, actual_price)'));
});
test('Handler revisi tetap mempertahankan bukti lama dan tidak mengizinkan revisi setelah pencairan', async()=>{
    const f=fixture({budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Revisi PJ',proof_file_url:'https://example.test/proof.pdf'}],disbursements:[{id:'d',budget_request_id:'r',amount:20,status:'Telah Diterima'}]});const response=await f.call('update_request',{request_id:'r',items:[{item_name:'Bahan',category:'Bahan',quantity:1,unit_price:50}]},2);assert.equal(response.code,409);assert.equal(f.state.budget_requests[0].proof_file_url,'https://example.test/proof.pdf');
});
test('Kegagalan penyimpanan rincian revisi mempertahankan header dan rincian lama', async()=>{
    const f=fixture({budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Revisi PJ',activity_name:'Lama',proof_file_url:'https://example.test/proof.pdf'}]},(table,op)=>table==='budget_request_items'&&op==='insert');
    const response=await f.call('update_request',{request_id:'r',activity_name:'Baru',proof_url:'https://example.test/proof.pdf',items:[{item_name:'Baru',category:'Bahan',quantity:1,unit_price:50}]},2);
    assert.equal(response.code,500);assert.equal(f.state.budget_requests[0].activity_name,'Lama');assert.equal(f.state.budget_request_items[0].unit_price,100);
});
test('Konfirmasi dua tahap terpisah bersamaan menjumlahkan penerimaan secara utuh', async()=>{
    const f=fixture({budget_requests:[{id:'r',pj_user_id:2,division_id:'B',status:'Menunggu Konfirmasi PJ',total_amount:100,total_disbursed:0}],disbursements:[{id:'one',budget_request_id:'r',status:'Menunggu Konfirmasi',amount:40},{id:'two',budget_request_id:'r',status:'Menunggu Konfirmasi',amount:60}]});
    const responses=await Promise.all([f.call('confirm_disbursement',{request_id:'r',disbursement_ids:['one']},2),f.call('confirm_disbursement',{request_id:'r',disbursement_ids:['two']},2)]);
    assert(responses.every(response=>response.code===200));assert.equal(f.state.budget_requests[0].total_disbursed,100);assert.equal(f.state.budget_requests[0].status,'Menunggu Laporan PJ');
});
test('Realisasi per item bersifat kumulatif pada pencairan bertahap', async()=>{
    const f=fixture();assert.equal((await f.call('disburse_request',{request_id:'r',amount_to_disburse:60,items:[{id:'item',actual_price:60}]})).code,200);
    assert.equal((await f.call('confirm_disbursement',{request_id:'r'},2)).code,200);
    assert.equal((await f.call('disburse_request',{request_id:'r',amount_to_disburse:40,items:[{id:'item',actual_price:40}]})).code,200);
    assert.equal(f.state.budget_request_items[0].actual_price,100);
});
test('Persetujuan PPK ditolak jika komitmen melebihi pagu', async()=>{
    const f=fixture({financial_officers:[{user_id:1,role_type:'PPK'}],budget_requests:[{id:'r',pj_user_id:2,division_id:'B',created_at:'2026-10-12',status:'Menunggu PPK'}],division_budgets:[{id:'b',division_id:'B',period:'2026',category:'Bahan',initial_budget:50,total_budget:50}]});
    const response=await f.call('approve_request',{request_id:'r',status_action:'Approved'});assert.equal(response.code,409);assert.equal(f.state.budget_requests[0].status,'Menunggu PPK');
});
