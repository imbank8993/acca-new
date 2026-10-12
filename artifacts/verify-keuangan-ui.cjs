const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const vm=require('node:vm');
const React=require('react');
const ReactDOMServer=require('react-dom/server');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const utility={exports:{}};vm.runInNewContext(compile(fs.readFileSync('apps/web/lib/keuangan-security.ts','utf8')),{module:utility,exports:utility.exports});
const {escapeFinanceHtml}=utility.exports;
const component={exports:{}};
vm.runInNewContext(compile(fs.readFileSync('apps/web/app/keuangan/tabs/KeuanganTabPagu.tsx','utf8')),{module:component,exports:component.exports,require(name){if(name.includes('components/ui/Button'))return{Button:({children,leftIcon,isLoading,...props})=>React.createElement('button',props,children)};return require(name);}});
const props={canManageBudget:true,handleSaveBudget(){},budgetForm:{division_id:'A',category:'Bahan',total_budget:1000000},setBudgetForm(){},divisions:[{id:'A',name:'Akademik'},{id:'B',name:'Keasramaan'}],handleSaveMutation(){},mutationForm:{type:'Transfer',division_id:'A',to_division_id:'B',category:'Bahan',amount:100000,direction:'add',reason:'Penyesuaian program'},setMutationForm(){},savingMutation:false,budgets:[{id:'budget',divisions:{name:'Akademik'},category:'Bahan',total_budget:1000000,used_budget:400000,remaining_budget:600000}],mutations:[{id:'mutation',created_at:'2026-10-12',divisions:{name:'Akademik'},counterpart:{name:'Keasramaan'},category:'Bahan',mutation_type:'Transfer',amount:100000,reason:'Penyesuaian program'}],selectedYear:'2026',onYearChange(){}};
(async()=>{
 const registry={exports:{}};let registryResponse={status:200,body:{ok:true}};
 vm.runInNewContext(compile(fs.readFileSync('apps/web/lib/storage/file-registry.ts','utf8')),{module:registry,exports:registry.exports,console:{error(){}},require(){return{nestFetch:async()=>registryResponse};}});
 await registry.exports.registerUpload({file_url:'https://example.test/report.pdf'},true);
 for(const response of [{status:503,body:null},{status:200,body:{ok:false}}]){
  registryResponse=response;await assert.rejects(registry.exports.registerUpload({file_url:'https://example.test/report.pdf'},true));
 }
 await registry.exports.registerUpload({file_url:'https://example.test/other.pdf'});
 await assert.rejects(registry.exports.registerUpload({file_url:''},true));
 const upload=fs.readFileSync('apps/web/app/api/upload/route.ts','utf8');assert(upload.includes("signature !== '%PDF-'"));assert(upload.includes('}, requiresRegistry)'));assert(upload.includes('status: 503'));
 const browser=await require('puppeteer').launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();await page.setContent('<html><body></body></html>');await page.addScriptTag({path:require.resolve('sweetalert2/dist/sweetalert2.all.min.js')});
  const source=fs.readFileSync('apps/web/app/keuangan/view.tsx','utf8').replace(/\r\n/g,'\n');
  const start=source.indexOf('        const html = `',source.indexOf('async function handleDisburse'));const end=source.indexOf('`;\n',start);
  const module={exports:null};new Function('module','escapeFinanceHtml',compile('module.exports=(req:any)=>'+source.slice(start,end+1).replace('        const html = ','')+';'))(module,escapeFinanceHtml);
  const html=module.exports({budget_request_items:[{id:'x',item_name:'<img src="data:image/png;base64,invalid" onerror="window.__audit=1">',category:'Bahan',total_price:100,actual_price:60}]});
  await page.evaluate(html=>{void Swal.fire({html});},html);await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(await page.evaluate(()=>window.__audit),undefined);assert.equal(await page.$eval('#disburse_item_x',element=>element.value),'40');assert.equal(await page.$eval('.swal2-html-container',element=>element.querySelectorAll('img').length),0);
  const data=ReactDOMServer.renderToStaticMarkup(React.createElement(component.exports.default,props));await page.setContent(data);const text=await page.$eval('body',element=>element.textContent);assert(text.includes('Divisi Tujuan'));assert(text.includes('600.000'));assert(text.includes('Riwayat Mutasi Tahun 2026'));
  const readonly=ReactDOMServer.renderToStaticMarkup(React.createElement(component.exports.default,{...props,canManageBudget:false}));assert(readonly.includes('600.000'));assert(!readonly.includes('Simpan Pagu'));
  const adjustment=ReactDOMServer.renderToStaticMarkup(React.createElement(component.exports.default,{...props,mutationForm:{...props.mutationForm,type:'Penyesuaian'}}));assert(adjustment.includes('Kurangi Pagu'));
  assert(source.includes("['ADMIN', 'ADMINISTRATOR']"));assert(source.includes("const canManageBudget = myOfficerRoles.includes('BENDAHARA')"));
  assert(fs.readFileSync('apps/web/app/keuangan/tabs/KeuanganTabPengajuan.tsx','utf8').includes("proof_file_url: r.proof_file_url || ''"));
  console.log('Passed: upload registry failure handling, dialog escapes stored HTML, cumulative item remainder, budget summary, readonly access, transfer destination, adjustment direction, administrator roles, and proof preservation.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
