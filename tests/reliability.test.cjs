'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
let browser,server,url;
before(async()=>{
  const html=await fs.readFile(path.join(__dirname,'../Dialogue-Animator.html'));
  server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  url=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,
    args:['--no-sandbox','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function editor(t){
  const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  t.after(async()=>{await context.close();assert.deepEqual(errors,[],'No uncaught browser errors');});
  await page.goto(url);await page.waitForFunction(()=>!loadingProject);
  return page;
}
async function clock(page){await page.clock.install({time:1000});await page.clock.pauseAt(2000);}
async function fixture(page,rows){
  await page.evaluate(rows=>{
    stopAll();blocks=rows.map(b=>({id:blockId(),spk:'',expr:'1',wait:0,...b}));
    loadBlockEditor(0);$('vol-sl').value='0';
  },rows);
}
async function state(page){return page.evaluate(()=>({state:playbackState,index:curBlock,text:txtOut.textContent}));}
async function flush(page){await page.evaluate(()=>saveRecovery());}

// Each regression checks externally observable behavior, rather than timer implementation details.
test('draft edits survive switching, adding and moving blocks',async t=>{
  const p=await editor(t);
  await p.locator('#script-txt').fill('First draft');
  await p.locator('#btn-add-block').click();await p.locator('#script-txt').fill('Second draft');
  await p.locator('#btn-move-up').click();
  assert.equal(await p.locator('#script-txt').inputValue(),'Second draft');
  await p.locator('.blk-item').nth(1).click();
  assert.equal(await p.locator('#script-txt').inputValue(),'First draft');
});
test('Play uses current edits without Apply Block',async t=>{
  const p=await editor(t);await p.locator('#script-txt').fill('Latest draft');
  await p.locator('#btn-play').click();await p.locator('#btn-skip').click();
  assert.equal((await state(p)).text,'Latest draft');
});
test('deleting the playing last block stops safely and remains playable',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'One'},{txt:'Two'}]);
  await p.evaluate(()=>startBlock(1));await p.locator('.blk-del').nth(1).click();
  await p.clock.runFor(5000);assert.equal((await state(p)).state,'idle');
  await p.locator('#btn-play').click();await p.locator('#btn-skip').click();
  assert.equal((await state(p)).text,'One');
});
test('reordering or inserting during playback cancels the old session',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'One'},{txt:'Two'}]);
  await p.evaluate(()=>startBlock(1));await p.locator('#btn-move-dn').click();
  await p.clock.runFor(2000);assert.equal((await state(p)).state,'idle');
  await p.locator('#btn-play').click();await p.locator('#btn-add-block').click();
  await p.clock.runFor(2000);assert.equal((await state(p)).state,'idle');
});
test('Play resumes manual pause without restarting or losing delay',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'ABCD'}]);
  await p.locator('#btn-play').click();await p.clock.runFor(120);
  await p.locator('#btn-pause').click();const paused=(await state(p)).text;
  await p.clock.runFor(1000);assert.equal((await state(p)).text,paused);
  await p.locator('#btn-play').click();assert.equal((await state(p)).text,paused);
  await p.clock.runFor(120);assert.ok((await state(p)).text.length>paused.length);
});
test('automatic countdown pauses and preserves remaining time',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'A',wait:2},{txt:'B'}]);
  await p.locator('#btn-play').click();await p.locator('#btn-skip').click();await p.clock.runFor(500);
  await p.locator('#btn-pause').click();await p.clock.runFor(5000);
  assert.equal((await state(p)).index,0);
  await p.locator('#btn-play').click();await p.clock.runFor(1490);assert.equal((await state(p)).index,0);
  await p.clock.runFor(20);assert.equal((await state(p)).index,1);
});
test('script pause resumes once and keeps remaining time',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'[pause:1]ABCDE'}]);
  await p.locator('#btn-play').click();await p.clock.runFor(200);await p.locator('#btn-pause').click();
  await p.clock.runFor(2000);assert.equal((await state(p)).text,'');
  await p.locator('#btn-play').click();await p.clock.runFor(799);assert.equal((await state(p)).text,'');
  await p.clock.runFor(2);assert.equal((await state(p)).text,'A');
  await p.clock.runFor(113);assert.equal((await state(p)).text,'AB');
});
test('Stop during auto-wait makes the next Space start from block one',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'A',wait:1},{txt:'B'}]);
  await p.locator('#btn-play').click();await p.locator('#btn-skip').click();await p.locator('#btn-stop').click();
  await p.clock.runFor(5000);await p.locator('#preview').click();
  assert.equal((await state(p)).index,0);assert.equal((await state(p)).text,'A');
});
test('Stop resets paused playback, flash and shake',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'[flash][screenshake][pause:2]A'}]);
  await p.locator('#btn-play').click();await p.clock.runFor(10);await p.locator('#btn-pause').click();
  await p.locator('#btn-stop').click();await p.clock.runFor(5000);
  assert.equal((await state(p)).state,'idle');
  assert.equal(await p.locator('#flash-ov').evaluate(el=>el.style.opacity),'0');
  assert.equal(await p.locator('#preview').evaluate(el=>el.classList.contains('shake')),false);
});
test('dialogue markup remains literal text in both the list and preview',async t=>{
  const p=await editor(t);const text='<img src=x onerror=alert(1)>';
  await p.locator('#script-txt').fill(text);
  assert.equal(await p.locator('.blk-txt img').count(),0);
  assert.equal(await p.locator('.blk-txt').textContent(),text);
  await p.locator('#btn-play').click();await p.locator('#btn-skip').click();
  assert.equal((await state(p)).text,text);assert.equal(await p.locator('#txt-out img').count(),0);
});
test('unknown, invalid and escaped bracket tags remain visible',async t=>{
  const p=await editor(t);
  const text='Use [Enter] [expr:99] [pause:-2] \\[wave\\]';
  await p.locator('#script-txt').fill(text);await p.locator('#btn-play').click();await p.locator('#btn-skip').click();
  assert.equal((await state(p)).text,'Use [Enter] [expr:99] [pause:-2] [wave]');
});
test('pause zero, valid expressions and effects still work',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'[pause:0][expr:4][wave]AB[/]'}]);
  await p.locator('#btn-play').click();await p.clock.runFor(10);
  assert.equal((await state(p)).text,'A');assert.equal(await p.evaluate(()=>activeExpr),4);
  assert.equal(await p.locator('#txt-out .fx-wave').count(),1);
});
test('Presenter clicks advance and clean view hides recording overlays',async t=>{
  const p=await editor(t);await clock(p);await fixture(p,[{txt:'Hello'}]);
  await p.locator('#btn-pres').click();await p.locator('#preview').click();
  assert.equal((await state(p)).text,'H');
  for(const id of ['prog-bar','line-ctr','pres-hint']) assert.equal(await p.locator('#'+id).isVisible(),false);
  await p.keyboard.press('h');assert.equal(await p.locator('#pres-hint').isVisible(),true);
  await p.keyboard.press('Escape');assert.equal(await p.locator('#presenter').isVisible(),false);
});
test('automatic recovery restores edits, images and settings after reload',async t=>{
  const p=await editor(t);await clock(p);
  await p.locator('#script-txt').fill('Recovered draft');await p.locator('#char-name').fill('Nexis');
  await p.locator('#expr-grid input').first().setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(PNG,'base64')});
  await p.waitForFunction(()=>assetTasks.size===0 && !!expr[1]);
  await p.locator('#up-bg').setInputFiles({name:'background.png',mimeType:'image/png',buffer:Buffer.from(PNG,'base64')});
  await p.waitForFunction(()=>assetTasks.size===0 && !!bgImgUrl);
  await p.clock.runFor(350);await p.evaluate(()=>recoveryQueue);
  await p.reload();await p.waitForFunction(()=>!loadingProject);
  assert.equal(await p.locator('#script-txt').inputValue(),'Recovered draft');
  assert.equal(await p.locator('#char-name').inputValue(),'Nexis');
  assert.ok(await p.evaluate(()=>expr[1].startsWith('data:image/png;base64,') && bgImgUrl===expr[1]));
});
test('downloaded project contains assets and reopens in a fresh browser context',async t=>{
  const p=await editor(t);
  await p.locator('#script-txt').fill('Portable project');await p.locator('#ed-spk').fill('Nexis');
  await p.locator('#expr-grid input').first().setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(PNG,'base64')});
  await p.waitForFunction(()=>assetTasks.size===0 && !!expr[1]);
  const downloadPromise=p.waitForEvent('download');await p.locator('#btn-save-project').click();
  const download=await downloadPromise, bytes=await fs.readFile(await download.path());
  const data=JSON.parse(bytes);assert.equal(data.blocks[0].txt,'Portable project');assert.ok(data.assets.expressions[1]);
  const q=await editor(t);await q.locator('#open-project').setInputFiles({name:'project.json',mimeType:'application/json',buffer:bytes});
  await q.waitForFunction(()=>!loadingProject && blocks[0].txt==='Portable project');
  assert.equal(await q.locator('#ed-spk').inputValue(),'Nexis');assert.ok(await q.evaluate(()=>!!expr[1]));
});
test('invalid import preserves current work and can be retried',async t=>{
  const p=await editor(t);await p.locator('#script-txt').fill('Keep me');
  const broken=await p.evaluate(()=>{const p=captureProject();p.blocks[0].wait=-1;return p;});
  await p.locator('#open-project').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
  await p.waitForFunction(()=>!loadingProject);
  assert.equal(await p.locator('#script-txt').inputValue(),'Keep me');
  assert.match(await p.locator('#toast').textContent(),/Could not open/);
});
test('canceling project replacement retains the current draft',async t=>{
  const p=await editor(t);const data=await p.evaluate(()=>captureProject());
  await p.locator('#script-txt').fill('Keep this draft');p.once('dialog',d=>d.dismiss());
  await p.locator('#open-project').setInputFiles({name:'other.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await p.waitForFunction(()=>!loadingProject);assert.equal(await p.locator('#script-txt').inputValue(),'Keep this draft');
});
test('storage failures are visible while file export stays available',async t=>{
  const p=await editor(t);await p.evaluate(()=>{recoveryStore=async()=>{throw new Error('Quota exceeded');};});
  await p.locator('#script-txt').fill('Still exportable');await flush(p);
  assert.match(await p.locator('#save-status').textContent(),/Recovery unavailable/);
  const promise=p.waitForEvent('download');await p.locator('#btn-save-project').click();
  assert.equal((await promise).suggestedFilename(),'dialogue-project.json');
});
test('bad recovery data reports failure and leaves a usable editor',async t=>{
  const p=await editor(t);await p.evaluate(()=>recoveryStore('readwrite',{version:999}));
  await p.reload();await p.waitForFunction(()=>!loadingProject);
  assert.match(await p.locator('#save-status').textContent(),/Recovery unavailable/);
  await p.locator('#script-txt').fill('Replacement');await flush(p);
  assert.match(await p.locator('#save-status').textContent(),/Saved in browser/);
});
test('project validation rejects invalid settings and duplicate IDs are repaired',async t=>{
  const p=await editor(t);
  assert.equal(await p.evaluate(()=>{
    const data=captureProject();data.settings['box-bg']='url(unsafe)';
    try{validateProject(data);return false;}catch{return true;}
  }),true);
  assert.equal(await p.evaluate(()=>{
    const data=captureProject();data.blocks.push({...data.blocks[0]});
    const clean=validateProject(data);return clean.blocks[0].id!==clean.blocks[1].id;
  }),true);
});
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('local HTML opened directly supports recovery without a server',async t=>{
  const p=await editor(t);
  const {pathToFileURL}=require('node:url');
  await p.goto(pathToFileURL(path.join(__dirname,'../Dialogue-Animator.html')).href);
  await p.waitForFunction(()=>!loadingProject);
  await p.locator('#script-txt').fill('Local file draft');await flush(p);
  await p.reload();await p.waitForFunction(()=>!loadingProject);
  assert.equal(await p.locator('#script-txt').inputValue(),'Local file draft');
});
test('download waits for an image that is still being read',async t=>{
  const p=await editor(t);await clock(p);
  await p.evaluate(()=>{
    const original=FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL=function(file){
      const callback=this.onload;this.onload=e=>setTimeout(()=>callback(e),500);original.call(this,file);
    };
  });
  await p.locator('#expr-grid input').first().setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(PNG,'base64')});
  const downloadPromise=p.waitForEvent('download');await p.locator('#btn-save-project').click();
  assert.equal(await p.locator('#btn-save-project').isDisabled(),true);
  await p.clock.runFor(501);
  const download=await downloadPromise, data=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.ok(data.assets.expressions[1]);
});
test('temporary blank numeric fields cannot corrupt saved recovery',async t=>{
  const p=await editor(t);await p.locator('#bar-h').fill('');
  await p.locator('#script-txt').fill('Safe recovery');await flush(p);
  await p.reload();await p.waitForFunction(()=>!loadingProject);
  assert.equal(await p.locator('#script-txt').inputValue(),'Safe recovery');
  assert.equal(await p.locator('#bar-h').inputValue(),'100');
});
