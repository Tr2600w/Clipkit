// ── Safe localStorage: fallback to in-memory when file:// blocks access ──
const _mem = {};
const safeLS = (() => {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return localStorage;
  } catch(e) {
    console.warn('[ClipKit] localStorage blocked — using in-memory storage');
    return {
      _data: {},
      getItem(k){ return this._data[k] !== undefined ? this._data[k] : null; },
      setItem(k,v){ this._data[k] = String(v); },
      removeItem(k){ delete this._data[k]; },
      clear(){ this._data = {}; }
    };
  }
})();
const safeSession = (()=>{
  try{sessionStorage.setItem('__ck_test__','1');sessionStorage.removeItem('__ck_test__');return sessionStorage;}
  catch{return {_data:{},getItem(k){return this._data[k]||null;},setItem(k,v){this._data[k]=String(v);},removeItem(k){delete this._data[k];}};}
})();

const APP_SCHEMA_VERSION = 4;
const DEFAULT_FILE_PATTERN = '{YYMMDD}_{Publication}.pdf';
const WORK_STATUSES = ['draft','captured','ready','completed'];

function readJSON(key, fallback){
  try{
    const raw=safeLS.getItem(key);
    return raw===null?fallback:JSON.parse(raw);
  }catch(e){
    console.warn('[ClipKit] Invalid stored JSON:',key);
    return fallback;
  }
}

function normalizeEntry(entry){
  const next={...entry};
  const numericId=Number(next.id);
  next.id=Number.isFinite(numericId)?numericId:Date.now()+Math.floor(Math.random()*1000);
  if(next.prValue!==null&&next.prValue!==''&&Number.isFinite(Number(next.prValue)))next.prValue=Number(next.prValue);
  else next.prValue=null;
  if(!WORK_STATUSES.includes(next.status))next.status='draft';
  next.captureCount=Math.max(0,Number(next.captureCount)||0);
  next.duration=String(next.duration||'').trim();
  if(!next.createdAt)next.createdAt=new Date().toISOString();
  if(!next.updatedAt)next.updatedAt=next.createdAt;
  return next;
}


// ═══ DATA ═══
const DB_BASE=[{"key":"1197สายด่วนจราจร - FB","pub":"1197สายด่วนจราจร","platform":"Facebook","value":210000},{"key":"24news - FB","pub":"24news","platform":"Facebook","value":150000},{"key":"362degree.com","pub":"362degree.com","platform":"Web","value":150000},{"key":"3Plusnews - FB","pub":"3Plusnews","platform":"Facebook","value":360000},{"key":"3Plusnews - X","pub":"3Plusnews","platform":"X","value":360000},{"key":"3Plusnews - YT","pub":"3Plusnews","platform":"YouTube","value":360000},{"key":"7days everynews.th - FB","pub":"7days everynews.th","platform":"Facebook","value":150000},{"key":"A day - FB","pub":"A day","platform":"Facebook","value":360000},{"key":"A day - IG","pub":"A day","platform":"Instagram","value":360000},{"key":"A day - Tiktok","pub":"A day","platform":"TikTok","value":360000},{"key":"A day - X","pub":"A day","platform":"X","value":360000},{"key":"A day - YT","pub":"A day","platform":"YouTube","value":360000},{"key":"A Nice Entertainment - FB","pub":"A Nice Entertainment","platform":"Facebook","value":150000},{"key":"A Nice Entertainment - X","pub":"A Nice Entertainment","platform":"X","value":150000},{"key":"A Nice Entertainment - YT","pub":"A Nice Entertainment","platform":"YouTube","value":150000},{"key":"A-roundent.com","pub":"A-roundent.com","platform":"Web","value":150000},{"key":"A.Round - FB","pub":"A.Round","platform":"Facebook","value":150000},{"key":"A.Round - X","pub":"A.Round","platform":"X","value":150000},{"key":"A.Round - YT","pub":"A.Round","platform":"YouTube","value":150000},{"key":"A.Round Entertainment - FB","pub":"A.Round Entertainment","platform":"Facebook","value":150000},{"key":"A.Round Entertainment - X","pub":"A.Round Entertainment","platform":"X","value":150000},{"key":"A.Round Entertainment - YT","pub":"A.Round Entertainment","platform":"YouTube","value":150000},{"key":"Acnews - FB","pub":"Acnews","platform":"Facebook","value":150000},{"key":"Acnews - X","pub":"Acnews","platform":"X","value":150000},{"key":"Acnews.net","pub":"Acnews.net","platform":"Web","value":150000},{"key":"AD ADDICT - FB","pub":"AD ADDICT","platform":"Facebook","value":360000},{"key":"AD ADDICT - IG","pub":"AD ADDICT","platform":"Instagram","value":360000},{"key":"AD ADDICT - Tiktok","pub":"AD ADDICT","platform":"TikTok","value":360000},{"key":"Adaddictth.com","pub":"Adaddictth.com","platform":"Web","value":360000},{"key":"Adaymagazine - FB","pub":"Adaymagazine","platform":"Facebook","value":360000},{"key":"Adaymagazine - IG","pub":"Adaymagazine","platform":"Instagram","value":360000},{"key":"Adaymagazine - Tiktok","pub":"Adaymagazine","platform":"TikTok","value":360000},{"key":"Adaymagazine - YT","pub":"Adaymagazine","platform":"YouTube","value":360000},{"key":"Adslthailand - X","pub":"Adslthailand","platform":"X","value":150000},{"key":"Adslthailand.com","pub":"Adslthailand.com","platform":"Web","value":150000},{"key":"All Area Entertainment - FB","pub":"All Area Entertainment","platform":"Facebook","value":150000},{"key":"All Area Entertainment - X","pub":"All Area Entertainment","platform":"X","value":150000},{"key":"All Area Entertainment - YT","pub":"All Area Entertainment","platform":"YouTube","value":150000},{"key":"All News - FB","pub":"All News","platform":"Facebook","value":150000},{"key":"Allmiles.net","pub":"Allmiles.net","platform":"Web","value":150000},{"key":"Allnewsexpress - FB","pub":"Allnewsexpress","platform":"Facebook","value":150000},{"key":"Allnewsexpress - X","pub":"Allnewsexpress","platform":"X","value":150000},{"key":"Allnewsexpress.com","pub":"Allnewsexpress.com","platform":"Web","value":150000},{"key":"Allnewsexpress1 - X","pub":"Allnewsexpress1","platform":"X","value":150000},{"key":"Allnewsth - X","pub":"Allnewsth","platform":"X","value":150000},{"key":"Allnewsth - YT","pub":"Allnewsth","platform":"YouTube","value":150000},{"key":"Amamylinnn - IG","pub":"Amamylinnn","platform":"Instagram","value":150000},{"key":"Amamylinnn - Tiktok","pub":"Amamylinnn","platform":"TikTok","value":150000},{"key":"Amarin Baby & Kids - FB","pub":"Amarin Baby & Kids","platform":"Facebook","value":360000},{"key":"Amarintv - FB","pub":"Amarintv","platform":"Facebook","value":360000},{"key":"Amarintv - LINE TODAY","pub":"Amarintv","platform":"LINE TODAY","value":360000},{"key":"Amarintv - YT","pub":"Amarintv","platform":"YouTube","value":360000},{"key":"Amarintv Hd 34 - YT","pub":"Amarintv Hd 34","platform":"YouTube","value":210000},{"key":"Amarintv.com","pub":"Amarintv.com","platform":"Web","value":360000},{"key":"Amatyai - IG","pub":"Amatyai","platform":"Instagram","value":210000},{"key":"Anice-entertainment.net","pub":"Anice-entertainment.net","platform":"Web","value":150000},{"key":"Apop today - FB","pub":"Apop today","platform":"Facebook","value":210000},{"key":"AROUND Magazine - FB","pub":"AROUND Magazine","platform":"Facebook","value":210000},{"key":"AROUND Magazine - IG","pub":"AROUND Magazine","platform":"Instagram","value":210000},{"key":"AROUNDmagazine.com","pub":"AROUNDmagazine.com","platform":"Web","value":210000},{"key":"Aroundonline.com","pub":"Aroundonline.com","platform":"Web","value":210000},{"key":"Arsa-story.co","pub":"Arsa-story.co","platform":"Web","value":150000},{"key":"Arsa-story.com","pub":"Arsa-story.com","platform":"Web","value":150000},{"key":"Art is art อะไร(แม่ง)ก็เป็นศิลปะ - YT","pub":"Art is art อะไร(แม่ง)ก็เป็นศิลปะ","platform":"YouTube","value":150000},{"key":"Art Of - FB","pub":"Art Of","platform":"Facebook","value":210000},{"key":"Art Of - IG","pub":"Art Of","platform":"Instagram","value":210000},{"key":"Art Of - X","pub":"Art Of","platform":"X","value":210000},{"key":"Art Tank Media - FB","pub":"Art Tank Media","platform":"Facebook","value":150000},{"key":"Art Tank Media - IG","pub":"Art Tank Media","platform":"Instagram","value":150000},{"key":"Art4D - FB","pub":"Art4D","platform":"Facebook","value":210000},{"key":"Art4D - IG","pub":"Art4D","platform":"Instagram","value":210000},{"key":"Artbangkok Thailand - FB","pub":"Artbangkok Thailand","platform":"Facebook","value":150000},{"key":"Artswork - FB","pub":"Artswork","platform":"Facebook","value":150000},{"key":"Artswork - YT","pub":"Artswork","platform":"YouTube","value":150000},{"key":"Artswork Ad - FB","pub":"Artswork Ad","platform":"Facebook","value":150000},{"key":"Artventure - FB","pub":"Artventure","platform":"Facebook","value":150000},{"key":"Aseanallnews.com","pub":"Aseanallnews.com","platform":"Web","value":150000},{"key":"Atkitchenmag.com","pub":"Atkitchenmag.com","platform":"Web","value":210000},{"key":"Atta - FB","pub":"Atta","platform":"Facebook","value":150000},{"key":"Atta - IG","pub":"Atta","platform":"Instagram","value":150000},{"key":"Atta Gallery - FB","pub":"Atta Gallery","platform":"Facebook","value":150000},{"key":"Balancemag.net","pub":"Balancemag.net","platform":"Web","value":150000},{"key":"Bangkok wealth & biz - FB","pub":"Bangkok wealth & biz","platform":"Facebook","value":150000},{"key":"Bangkok-online - FB","pub":"Bangkok-online","platform":"Facebook","value":150000},{"key":"Bangkok-Today - FB","pub":"Bangkok-Today","platform":"Facebook","value":210000},{"key":"Bangkok-today.com","pub":"Bangkok-today.com","platform":"Web","value":210000},{"key":"Bangkok_Bma - IG","pub":"Bangkok_Bma","platform":"Instagram","value":210000},{"key":"Bangkokartcity - IG","pub":"Bangkokartcity","platform":"Instagram","value":210000},{"key":"Bangkokartcity.org","pub":"Bangkokartcity.org","platform":"Web","value":150000},{"key":"Bangkokbiznews - FB","pub":"Bangkokbiznews","platform":"Facebook","value":210000},{"key":"Bangkokbiznews - LINE TODAY","pub":"Bangkokbiznews","platform":"LINE TODAY","value":210000},{"key":"Bangkokbiznews.com","pub":"Bangkokbiznews.com","platform":"Web","value":210000},{"key":"Bangkokpost - X","pub":"Bangkokpost","platform":"X","value":210000},{"key":"Bangkokpost - YT","pub":"Bangkokpost","platform":"YouTube","value":210000},{"key":"Bangkokpost.com","pub":"Bangkokpost.com","platform":"Web","value":210000},{"key":"Bangnainsight - IG","pub":"Bangnainsight","platform":"Instagram","value":150000},{"key":"Bankmakeup - FB","pub":"Bankmakeup","platform":"Facebook","value":150000},{"key":"Bankmakeup - IG","pub":"Bankmakeup","platform":"Instagram","value":150000},{"key":"Banmuang - FB","pub":"Banmuang","platform":"Facebook","value":210000},{"key":"Banmuang.co.th","pub":"Banmuang.co.th","platform":"Web","value":210000},{"key":"Banteedin108.com","pub":"Banteedin108.com","platform":"Web","value":150000},{"key":"Banterngstation.com","pub":"Banterngstation.com","platform":"Web","value":150000},{"key":"Beartai - Line","pub":"Beartai","platform":"LINE","value":360000},{"key":"Beartai - LINE TODAY","pub":"Beartai","platform":"LINE TODAY","value":360000},{"key":"Beartai FLASH - FB","pub":"Beartai FLASH","platform":"Facebook","value":150000},{"key":"Beartai.com","pub":"Beartai.com","platform":"Web","value":360000},{"key":"Beautilista.com","pub":"Beautilista.com","platform":"Web","value":150000},{"key":"Behi Entertainment - X","pub":"Behi Entertainment","platform":"X","value":150000},{"key":"Bewlomthong - FB","pub":"Bewlomthong","platform":"Facebook","value":150000},{"key":"Bewlomthong - IG","pub":"Bewlomthong","platform":"Instagram","value":150000},{"key":"Bizmatchingnews - X","pub":"Bizmatchingnews","platform":"X","value":150000},{"key":"Bizmatchingnews.com","pub":"Bizmatchingnews.com","platform":"Web","value":150000},{"key":"Bizpromptinfofanpage - FB","pub":"Bizpromptinfofanpage","platform":"Facebook","value":210000},{"key":"Biztalknews.com","pub":"Biztalknews.com","platform":"Web","value":150000},{"key":"Biztodaynews.com","pub":"Biztodaynews.com","platform":"Web","value":150000},{"key":"Biztodaystation.com","pub":"Biztodaystation.com","platform":"Web","value":150000},{"key":"Biztosuccess.com","pub":"Biztosuccess.com","platform":"Web","value":150000},{"key":"Bk.asia-city.com","pub":"Bk.asia-city.com","platform":"Web","value":360000},{"key":"Bkk head news - FB","pub":"Bkk head news","platform":"Facebook","value":150000},{"key":"Bkk Now - FB","pub":"Bkk Now","platform":"Facebook","value":150000},{"key":"Bkkmenu - FB","pub":"Bkkmenu","platform":"Facebook","value":210000},{"key":"Bkkmenu - IG","pub":"Bkkmenu","platform":"Instagram","value":210000},{"key":"Bkkmenu - X","pub":"Bkkmenu","platform":"X","value":210000},{"key":"Bkmagazine - FB","pub":"Bkmagazine","platform":"Facebook","value":360000},{"key":"Bkmagazine - IG","pub":"Bkmagazine","platform":"Instagram","value":360000},{"key":"Bluechipthai - FB","pub":"Bluechipthai","platform":"Facebook","value":150000},{"key":"Bluechipthai.com","pub":"Bluechipthai.com","platform":"Web","value":150000},{"key":"Boots Thailand - FB","pub":"Boots Thailand","platform":"Facebook","value":150000},{"key":"Brand Buffet - FB","pub":"Brand Buffet","platform":"Facebook","value":210000},{"key":"Brand Inside - FB","pub":"Brand Inside","platform":"Facebook","value":210000},{"key":"Brandage - FB","pub":"Brandage","platform":"Facebook","value":210000},{"key":"Brandage - IG","pub":"Brandage","platform":"Instagram","value":210000},{"key":"Brandage.com","pub":"Brandage.com","platform":"Web","value":210000},{"key":"Brandbiznews.com","pub":"Brandbiznews.com","platform":"Web","value":150000},{"key":"Brandbuffet.co.th","pub":"Brandbuffet.co.th","platform":"Web","value":210000},{"key":"Brandbuffet.in.th","pub":"Brandbuffet.in.th","platform":"Web","value":210000},{"key":"Brandcase.co","pub":"Brandcase.co","platform":"Web","value":150000},{"key":"Brandinside.asia","pub":"Brandinside.asia","platform":"Web","value":210000},{"key":"BrandThink - FB","pub":"BrandThink","platform":"Facebook","value":360000},{"key":"BrandThink - IG","pub":"BrandThink","platform":"Instagram","value":360000},{"key":"Brickinfotv - FB","pub":"Brickinfotv","platform":"Facebook","value":150000},{"key":"Brickinfotv - X","pub":"Brickinfotv","platform":"X","value":150000},{"key":"Brickinfotv.com","pub":"Brickinfotv.com","platform":"Web","value":150000},{"key":"Bright Tv - YT","pub":"Bright Tv","platform":"YouTube","value":360000},{"key":"Brighttv.co.th","pub":"Brighttv.co.th","platform":"Web","value":210000},{"key":"Bscenelight - FB","pub":"Bscenelight","platform":"Facebook","value":150000},{"key":"Bscenelight - IG","pub":"Bscenelight","platform":"Instagram","value":150000},{"key":"Bscenelight - X","pub":"Bscenelight","platform":"X","value":150000},{"key":"Bugaboo.tv","pub":"Bugaboo.tv","platform":"Web","value":360000},{"key":"Bunterng Thai Online - FB","pub":"Bunterng Thai Online","platform":"Facebook","value":150000},{"key":"Bunterng Thai Online - IG","pub":"Bunterng Thai Online","platform":"Instagram","value":150000},{"key":"Bunterng Thai Online - X","pub":"Bunterng Thai Online","platform":"X","value":150000},{"key":"Bunterng Thai Online - YT","pub":"Bunterng Thai Online","platform":"YouTube","value":150000},{"key":"Bunterngonline - X","pub":"Bunterngonline","platform":"X","value":150000},{"key":"Bunterngonline - YT","pub":"Bunterngonline","platform":"YouTube","value":150000},{"key":"Bunterngthaionline.com","pub":"Bunterngthaionline.com","platform":"Web","value":150000},{"key":"BusinessIntrend - FB","pub":"BusinessIntrend","platform":"Facebook","value":150000},{"key":"Businessownertv - FB","pub":"Businessownertv","platform":"Facebook","value":150000},{"key":"Businessownertv.com","pub":"Businessownertv.com","platform":"Web","value":150000},{"key":"Cafeteller - FB","pub":"Cafeteller","platform":"Facebook","value":150000},{"key":"Cafeteller - IG","pub":"Cafeteller","platform":"Instagram","value":150000},{"key":"Campus-star.com","pub":"Campus-star.com","platform":"Web","value":210000},{"key":"Capitalread - FB","pub":"Capitalread","platform":"Facebook","value":210000},{"key":"Capitalread - IG","pub":"Capitalread","platform":"Instagram","value":210000},{"key":"Capitalread.co - FB","pub":"Capitalread.co","platform":"Facebook","value":210000},{"key":"Capitalread.co  - IG","pub":"Capitalread.co","platform":"Instagram","value":210000},{"key":"Capitalread.co  - Tiktok","pub":"Capitalread.co","platform":"TikTok","value":210000},{"key":"Carlifeway.com","pub":"Carlifeway.com","platform":"Web","value":150000},{"key":"Cbntchannel.com","pub":"Cbntchannel.com","platform":"Web","value":150000},{"key":"Celeb-online - FB","pub":"Celeb-online","platform":"Facebook","value":210000},{"key":"Celebonline.in.th","pub":"Celebonline.in.th","platform":"Web","value":210000},{"key":"Celebthailand.com","pub":"Celebthailand.com","platform":"Web","value":150000},{"key":"CH 8 - TV","pub":"CH 8","platform":"TV","value":360000},{"key":"Ch3plus.com","pub":"Ch3plus.com","platform":"Web","value":360000},{"key":"CH5 - TV","pub":"CH5","platform":"TV","value":448000},{"key":"CH5 - YT","pub":"CH5","platform":"YouTube","value":360000},{"key":"Ch7 - YT","pub":"Ch7","platform":"YouTube","value":360000},{"key":"CHANGE into Magazine - YT","pub":"CHANGE into Magazine","platform":"YouTube","value":150000},{"key":"Changeintomag.com","pub":"Changeintomag.com","platform":"Web","value":150000},{"key":"Changeintomagazineonline2022.blogspot.com","pub":"Changeintomagazineonline2022.blogspot.com","platform":"Web","value":150000},{"key":"Changeintomagazineonline2022.com","pub":"Changeintomagazineonline2022.com","platform":"Web","value":150000},{"key":"Check In Entertainment - FB","pub":"Check In Entertainment","platform":"Facebook","value":150000},{"key":"Check In Entertainment - X","pub":"Check In Entertainment","platform":"X","value":150000},{"key":"Cheeze Pop-Up - FB","pub":"Cheeze Pop-Up","platform":"Facebook","value":150000},{"key":"Cheeze Pop-Up - IG","pub":"Cheeze Pop-Up","platform":"Instagram","value":150000},{"key":"Cheeze Pop-Up Market - FB","pub":"Cheeze Pop-Up Market","platform":"Facebook","value":150000},{"key":"Cheeze Pop-Up Market - IG","pub":"Cheeze Pop-Up Market","platform":"Instagram","value":150000},{"key":"cheezelooker - FB","pub":"cheezelooker","platform":"Facebook","value":210000},{"key":"cheezelooker - IG","pub":"cheezelooker","platform":"Instagram","value":210000},{"key":"Cherie.Bonappetit - Tiktok","pub":"Cherie.Bonappetit","platform":"TikTok","value":150000},{"key":"Chieffocus.com","pub":"Chieffocus.com","platform":"Web","value":150000},{"key":"Chillandfin - FB","pub":"Chillandfin","platform":"Facebook","value":150000},{"key":"Chillandfin.com","pub":"Chillandfin.com","platform":"Web","value":150000},{"key":"Chillpainai Group - FB","pub":"Chillpainai Group","platform":"Facebook","value":210000},{"key":"Cioworldbusiness.com","pub":"Cioworldbusiness.com","platform":"Web","value":150000},{"key":"Cioworldnews.com","pub":"Cioworldnews.com","platform":"Web","value":150000},{"key":"Circle Entertainment Updates - Tiktok","pub":"Circle Entertainment Updates","platform":"TikTok","value":150000},{"key":"Circle Entertainment Updates - X","pub":"Circle Entertainment Updates","platform":"X","value":150000},{"key":"Citynewsthai.com","pub":"Citynewsthai.com","platform":"Web","value":150000},{"key":"Clicknews-tv - FB","pub":"Clicknews-tv","platform":"Facebook","value":150000},{"key":"Clicknews-tv - X","pub":"Clicknews-tv","platform":"X","value":150000},{"key":"Clicknews.link","pub":"Clicknews.link","platform":"Web","value":150000},{"key":"Cm2 - FB","pub":"Cm2","platform":"Facebook","value":150000},{"key":"Cm2 - X","pub":"Cm2","platform":"X","value":150000},{"key":"Cm2 - YT","pub":"Cm2","platform":"YouTube","value":150000},{"key":"Cm2Connect - X","pub":"Cm2Connect","platform":"X","value":150000},{"key":"Coconuts - IG","pub":"Coconuts","platform":"Instagram","value":150000},{"key":"Coconuts.co","pub":"Coconuts.co","platform":"Web","value":150000},{"key":"CoconutsBangkok - FB","pub":"CoconutsBangkok","platform":"Facebook","value":150000},{"key":"Columnai - FB","pub":"Columnai","platform":"Facebook","value":150000},{"key":"Columnai.com","pub":"Columnai.com","platform":"Web","value":150000},{"key":"Condotiddoi - FB","pub":"Condotiddoi","platform":"Facebook","value":210000},{"key":"Condotiddoi.com","pub":"Condotiddoi.com","platform":"Web","value":210000},{"key":"Contestwar - FB","pub":"Contestwar","platform":"Facebook","value":150000},{"key":"Contestwar - X","pub":"Contestwar","platform":"X","value":150000},{"key":"Contestwar.com","pub":"Contestwar.com","platform":"Web","value":150000},{"key":"Coolzaa.com","pub":"Coolzaa.com","platform":"Web","value":150000},{"key":"Corehoononline.com","pub":"Corehoononline.com","platform":"Web","value":150000},{"key":"Couple Travel พาแฟนไปไหนดี","pub":"Couple Travel พาแฟนไปไหนดี","platform":"Web","value":210000},{"key":"Creativeecon.asia","pub":"Creativeecon.asia","platform":"Web","value":150000},{"key":"Dailyboomm - FB","pub":"Dailyboomm","platform":"Facebook","value":150000},{"key":"Dailyboomm.com","pub":"Dailyboomm.com","platform":"Web","value":150000},{"key":"Dailynews - FB","pub":"Dailynews","platform":"Facebook","value":360000},{"key":"Dailynews - Line","pub":"Dailynews","platform":"LINE","value":360000},{"key":"Dailynews - LINE TODAY","pub":"Dailynews","platform":"LINE TODAY","value":360000},{"key":"Dailynews.co.th","pub":"Dailynews.co.th","platform":"Web","value":360000},{"key":"Dailynews.com","pub":"Dailynews.com","platform":"Web","value":360000},{"key":"Dara 2u - YT","pub":"Dara 2u","platform":"YouTube","value":150000},{"key":"Daradaily - FB","pub":"Daradaily","platform":"Facebook","value":210000},{"key":"Daradaily - X","pub":"Daradaily","platform":"X","value":210000},{"key":"Daradaily - YT","pub":"Daradaily","platform":"YouTube","value":210000},{"key":"Daradaily.com","pub":"Daradaily.com","platform":"Web","value":210000},{"key":"Dek-D - FB","pub":"Dek-D","platform":"Facebook","value":360000},{"key":"Dek-d.com","pub":"Dek-d.com","platform":"Web","value":360000},{"key":"DNext - Dailynews Next - FB","pub":"DNext - Dailynews Next","platform":"Facebook","value":150000},{"key":"Dooddot - FB","pub":"Dooddot","platform":"Facebook","value":210000},{"key":"Dooddot.com","pub":"Dooddot.com","platform":"Web","value":210000},{"key":"Dust_ntk - IG","pub":"Dust_ntk","platform":"Instagram","value":210000},{"key":"Eat Here - FB","pub":"Eat Here","platform":"Facebook","value":360000},{"key":"Eatindeed - IG","pub":"Eatindeed","platform":"Instagram","value":210000},{"key":"Eatography - IG","pub":"Eatography","platform":"Instagram","value":210000},{"key":"Ebiznewstoday.com","pub":"Ebiznewstoday.com","platform":"Web","value":150000},{"key":"Eco day news - FB","pub":"Eco day news","platform":"Facebook","value":150000},{"key":"Economixnews - FB","pub":"Economixnews","platform":"Facebook","value":150000},{"key":"Economixnews.com","pub":"Economixnews.com","platform":"Web","value":150000},{"key":"Edtguide - FB","pub":"Edtguide","platform":"Facebook","value":360000},{"key":"Edtguide - IG","pub":"Edtguide","platform":"Instagram","value":360000},{"key":"Eduzones.com","pub":"Eduzones.com","platform":"Web","value":210000},{"key":"ELLE Beauty Thailand - IG","pub":"ELLE Beauty Thailand","platform":"Instagram","value":360000},{"key":"Elle Thailand - FB","pub":"Elle Thailand","platform":"Facebook","value":360000},{"key":"Elle Thailand  - IG","pub":"Elle Thailand","platform":"Instagram","value":360000},{"key":"Ellementhailand - FB","pub":"Ellementhailand","platform":"Facebook","value":360000},{"key":"Ellementhailand - IG","pub":"Ellementhailand","platform":"Instagram","value":360000},{"key":"Ellementhailand - Tiktok","pub":"Ellementhailand","platform":"TikTok","value":360000},{"key":"Ellementhailand - X","pub":"Ellementhailand","platform":"X","value":360000},{"key":"Ellementhailand.com","pub":"Ellementhailand.com","platform":"Web","value":360000},{"key":"Ellethailand.com","pub":"Ellethailand.com","platform":"Web","value":360000},{"key":"Ellethailandofficial - IG","pub":"Ellethailandofficial","platform":"Instagram","value":360000},{"key":"Emouth Gossip - FB","pub":"Emouth Gossip","platform":"Facebook","value":150000},{"key":"Emouth Gossip - X","pub":"Emouth Gossip","platform":"X","value":150000},{"key":"En-tk.com","pub":"En-tk.com","platform":"Web","value":150000},{"key":"Entertainaddicted - YT","pub":"Entertainaddicted","platform":"YouTube","value":150000},{"key":"Entown - YT","pub":"Entown","platform":"YouTube","value":150000},{"key":"Ep News - FB","pub":"Ep News","platform":"Facebook","value":150000},{"key":"Ep News - Tiktok","pub":"Ep News","platform":"TikTok","value":150000},{"key":"Ep News - X","pub":"Ep News","platform":"X","value":150000},{"key":"Ep News - YT","pub":"Ep News","platform":"YouTube","value":150000},{"key":"Esquire - FB","pub":"Esquire","platform":"Facebook","value":150000},{"key":"Esquire - IG","pub":"Esquire","platform":"Instagram","value":150000},{"key":"Esquire.co.th","pub":"Esquire.co.th","platform":"Web","value":150000},{"key":"Event96pronline.com","pub":"Event96pronline.com","platform":"Web","value":150000},{"key":"Eventbanana - Tiktok","pub":"Eventbanana","platform":"TikTok","value":150000},{"key":"EventPass - FB","pub":"EventPass","platform":"Facebook","value":360000},{"key":"EventPass - IG","pub":"EventPass","platform":"Instagram","value":360000},{"key":"EventPass - Tiktok","pub":"EventPass","platform":"TikTok","value":360000},{"key":"Eventpass.co","pub":"Eventpass.co","platform":"Web","value":360000},{"key":"Eventpassapp - FB","pub":"Eventpassapp","platform":"Facebook","value":360000},{"key":"Eventpassapp - IG","pub":"Eventpassapp","platform":"Instagram","value":360000},{"key":"Eventpassapp - Tiktok","pub":"Eventpassapp","platform":"TikTok","value":360000},{"key":"Eventpop - FB","pub":"Eventpop","platform":"Facebook","value":210000},{"key":"Eventpop - IG","pub":"Eventpop","platform":"Instagram","value":210000},{"key":"Eventpop - Tiktok","pub":"Eventpop","platform":"TikTok","value":210000},{"key":"Eventpop - X","pub":"Eventpop","platform":"X","value":210000},{"key":"Eventpop.me","pub":"Eventpop.me","platform":"Web","value":210000},{"key":"Exhibition.contestwar.com","pub":"Exhibition.contestwar.com","platform":"Web","value":150000},{"key":"Facelinenews.com","pub":"Facelinenews.com","platform":"Web","value":150000},{"key":"Fanpage Ac-News - FB","pub":"Fanpage Ac-News","platform":"Facebook","value":150000},{"key":"Faye_malisorn - IG","pub":"Faye_malisorn","platform":"Instagram","value":210000},{"key":"Feed - YT","pub":"Feed","platform":"YouTube","value":360000},{"key":"Find Me Events - Thailand - FB","pub":"Find Me Events - Thailand","platform":"Facebook","value":150000},{"key":"Findevent.space","pub":"Findevent.space","platform":"Web","value":150000},{"key":"Findinfoblog.com","pub":"Findinfoblog.com","platform":"Web","value":150000},{"key":"Fineart Magazine Thailand - FB","pub":"Fineart Magazine Thailand","platform":"Facebook","value":150000},{"key":"Fineart Magazine Thailand - IG","pub":"Fineart Magazine Thailand","platform":"Instagram","value":150000},{"key":"Flying Whale │ วาฬมีปีก - FB","pub":"Flying Whale │ วาฬมีปีก","platform":"Facebook","value":360000},{"key":"Flying Whale │ วาฬมีปีก - IG","pub":"Flying Whale │ วาฬมีปีก","platform":"Instagram","value":360000},{"key":"Flying Whale │ วาฬมีปีก - Tiktok","pub":"Flying Whale │ วาฬมีปีก","platform":"TikTok","value":360000},{"key":"Flying Whale │ วาฬมีปีก - X","pub":"Flying Whale │ วาฬมีปีก","platform":"X","value":360000},{"key":"Flying Whale│วาฬมีปีก - Fb - FB","pub":"Flying Whale│วาฬมีปีก - Fb","platform":"Facebook","value":360000},{"key":"Flying Whale│วาฬมีปีก - Fb - IG","pub":"Flying Whale│วาฬมีปีก - Fb","platform":"Instagram","value":360000},{"key":"Flyingwhale.me","pub":"Flyingwhale.me","platform":"Web","value":360000},{"key":"FOOD BLOG BKK - FB","pub":"FOOD BLOG BKK","platform":"Facebook","value":210000},{"key":"Food.trueid.net","pub":"Food.trueid.net","platform":"Web","value":360000},{"key":"Foodanyway - IG","pub":"Foodanyway","platform":"Instagram","value":210000},{"key":"Foodyoucaneat - IG","pub":"Foodyoucaneat","platform":"Instagram","value":210000},{"key":"Forbes Thailand Magazine - FB","pub":"Forbes Thailand Magazine","platform":"Facebook","value":210000},{"key":"Forbesthailand.com","pub":"Forbesthailand.com","platform":"Web","value":210000},{"key":"Fotoinfo - กล้อง ถ่ายภาพ ท่องเที่ยว - FB","pub":"Fotoinfo - กล้อง ถ่ายภาพ ท่องเที่ยว","platform":"Facebook","value":210000},{"key":"Fotoinfo.online","pub":"Fotoinfo.online","platform":"Web","value":150000},{"key":"Fourteenchannel - FB","pub":"Fourteenchannel","platform":"Facebook","value":150000},{"key":"Fourteenchannel - X","pub":"Fourteenchannel","platform":"X","value":150000},{"key":"Fourteenchannel - YT","pub":"Fourteenchannel","platform":"YouTube","value":150000},{"key":"Fourteenchannel.com","pub":"Fourteenchannel.com","platform":"Web","value":150000},{"key":"Friday Bangkok - FB","pub":"Friday Bangkok","platform":"Facebook","value":150000},{"key":"Friday Bangkok - IG","pub":"Friday Bangkok","platform":"Instagram","value":150000},{"key":"Fridaybkk.En - FB","pub":"Fridaybkk.En","platform":"Facebook","value":150000},{"key":"Fridaybkk.En - IG","pub":"Fridaybkk.En","platform":"Instagram","value":150000},{"key":"Fridaybkk.Th - FB","pub":"Fridaybkk.Th","platform":"Facebook","value":210000},{"key":"Fridaybkk.Th - IG","pub":"Fridaybkk.Th","platform":"Instagram","value":210000},{"key":"Fscc.Th - IG","pub":"Fscc.Th","platform":"Instagram","value":210000},{"key":"Fscc.Th - Tiktok","pub":"Fscc.Th","platform":"TikTok","value":210000},{"key":"Fullmax.cc","pub":"Fullmax.cc","platform":"Web","value":150000},{"key":"Fun Drive Thailand - FB","pub":"Fun Drive Thailand","platform":"Facebook","value":150000},{"key":"Fundrivethailand.com","pub":"Fundrivethailand.com","platform":"Web","value":150000},{"key":"Future of Thailand - FB","pub":"Future of Thailand","platform":"Facebook","value":150000},{"key":"Future Trends - FB","pub":"Future Trends","platform":"Facebook","value":210000},{"key":"Fyi Bangkok - FB","pub":"Fyi Bangkok","platform":"Facebook","value":150000},{"key":"Fyi Bangkok - IG","pub":"Fyi Bangkok","platform":"Instagram","value":150000},{"key":"Gangway Thailand - FB","pub":"Gangway Thailand","platform":"Facebook","value":150000},{"key":"Gangway Thailand - IG","pub":"Gangway Thailand","platform":"Instagram","value":150000},{"key":"Gangway.th - FB","pub":"Gangway.th","platform":"Facebook","value":150000},{"key":"Gangway.th - IG","pub":"Gangway.th","platform":"Instagram","value":150000},{"key":"Gdpbusiness.com","pub":"Gdpbusiness.com","platform":"Web","value":150000},{"key":"Glineye - FB","pub":"Glineye","platform":"Facebook","value":150000},{"key":"Glineye - IG","pub":"Glineye","platform":"Instagram","value":150000},{"key":"Glitzmagazines.com","pub":"Glitzmagazines.com","platform":"Web","value":150000},{"key":"GM Live - FB","pub":"GM Live","platform":"Facebook","value":210000},{"key":"Go Went Korn - FB","pub":"Go Went Korn","platform":"Facebook","value":150000},{"key":"Go Went Korn - IG","pub":"Go Went Korn","platform":"Instagram","value":150000},{"key":"GO With Her - FB","pub":"GO With Her","platform":"Facebook","value":210000},{"key":"Goplay magazine - FB","pub":"Goplay magazine","platform":"Facebook","value":210000},{"key":"Gorgeousbkk - FB","pub":"Gorgeousbkk","platform":"Facebook","value":210000},{"key":"Gorgeousbkk - Tiktok","pub":"Gorgeousbkk","platform":"TikTok","value":210000},{"key":"Gorgeousbkk.com","pub":"Gorgeousbkk.com","platform":"Web","value":210000},{"key":"Gossipstar.com","pub":"Gossipstar.com","platform":"Web","value":150000},{"key":"Gothrudrive.com","pub":"Gothrudrive.com","platform":"Web","value":150000},{"key":"Gotomanager - FB","pub":"Gotomanager","platform":"Facebook","value":210000},{"key":"Gotomanager.com","pub":"Gotomanager.com","platform":"Web","value":210000},{"key":"Gourmet&Cuisine - FB","pub":"Gourmet&Cuisine","platform":"Facebook","value":210000},{"key":"Gourmet&Cuisine - IG","pub":"Gourmet&Cuisine","platform":"Instagram","value":210000},{"key":"Gourmetandcuisine - FB","pub":"Gourmetandcuisine","platform":"Facebook","value":210000},{"key":"Gourmetandcuisine - IG","pub":"Gourmetandcuisine","platform":"Instagram","value":210000},{"key":"Gourmetandcuisine.com","pub":"Gourmetandcuisine.com","platform":"Web","value":210000},{"key":"Gourmetandcuisine.net","pub":"Gourmetandcuisine.net","platform":"Web","value":210000},{"key":"Gqthailand - FB","pub":"Gqthailand","platform":"Facebook","value":210000},{"key":"Gqthailand - IG","pub":"Gqthailand","platform":"Instagram","value":210000},{"key":"Greener.bangkok.go.th","pub":"Greener.bangkok.go.th","platform":"Web","value":210000},{"key":"Greenlifeplusmag.com","pub":"Greenlifeplusmag.com","platform":"Web","value":150000},{"key":"Greenpeace Thailand  - FB","pub":"Greenpeace Thailand","platform":"Facebook","value":210000},{"key":"Groundcontro - FB","pub":"Groundcontro","platform":"Facebook","value":210000},{"key":"GroundControl - FB","pub":"GroundControl","platform":"Facebook","value":210000},{"key":"GroundControl - IG","pub":"GroundControl","platform":"Instagram","value":210000},{"key":"GroundControl  - Tiktok","pub":"GroundControl","platform":"TikTok","value":210000},{"key":"Groundcontrolth - FB","pub":"Groundcontrolth","platform":"Facebook","value":210000},{"key":"Groundcontrolth - IG","pub":"Groundcontrolth","platform":"Instagram","value":210000},{"key":"Groundcontrolth.com","pub":"Groundcontrolth.com","platform":"Web","value":210000},{"key":"Guideofbangkok.com","pub":"Guideofbangkok.com","platform":"Web","value":150000},{"key":"Guru by Bangkok Post - FB","pub":"Guru by Bangkok Post","platform":"Facebook","value":210000},{"key":"Guru by Bangkok Post - IG","pub":"Guru by Bangkok Post","platform":"Instagram","value":210000},{"key":"Hafisbaba - IG","pub":"Hafisbaba","platform":"Instagram","value":150000},{"key":"Hafisbaba - Tiktok","pub":"Hafisbaba","platform":"TikTok","value":150000},{"key":"Happening Mag - FB","pub":"Happening Mag","platform":"Facebook","value":210000},{"key":"Happening Mag - IG","pub":"Happening Mag","platform":"Instagram","value":210000},{"key":"Happening Mag - X","pub":"Happening Mag","platform":"X","value":210000},{"key":"Happeningandfriends.com","pub":"Happeningandfriends.com","platform":"Web","value":210000},{"key":"Happeningbkk - FB","pub":"Happeningbkk","platform":"Facebook","value":150000},{"key":"Happeningbkk - IG","pub":"Happeningbkk","platform":"Instagram","value":150000},{"key":"Happeningbkk.com","pub":"Happeningbkk.com","platform":"Web","value":150000},{"key":"Happy Mama - FB","pub":"Happy Mama","platform":"Facebook","value":150000},{"key":"Harper'S Bazaar Thailand  - FB","pub":"Harper'S Bazaar Thailand","platform":"Facebook","value":210000},{"key":"Harper'S Bazaar Thailand","pub":"Harper'S Bazaar Thailand","platform":"Web","value":210000},{"key":"Headline - X","pub":"Headline","platform":"X","value":150000},{"key":"Headline.co.th","pub":"Headline.co.th","platform":"Web","value":150000},{"key":"Headtopics.com","pub":"Headtopics.com","platform":"Web","value":150000},{"key":"Health News Thailand - FB","pub":"Health News Thailand","platform":"Facebook","value":150000},{"key":"Hello Asian - FB","pub":"Hello Asian","platform":"Facebook","value":150000},{"key":"Hello Asian - X","pub":"Hello Asian","platform":"X","value":150000},{"key":"Hello Asian  - YT","pub":"Hello Asian","platform":"YouTube","value":150000},{"key":"HELLO! - IG","pub":"HELLO!","platform":"Instagram","value":360000},{"key":"HELLO! Magazine Thailand - IG","pub":"HELLO! Magazine Thailand","platform":"Instagram","value":360000},{"key":"Hello! Thailand - FB","pub":"Hello! Thailand","platform":"Facebook","value":360000},{"key":"Hello.98 - FB","pub":"Hello.98","platform":"Facebook","value":150000},{"key":"Hello.98 - IG","pub":"Hello.98","platform":"Instagram","value":150000},{"key":"Hello.98 - X","pub":"Hello.98","platform":"X","value":150000},{"key":"Hello.98 - YT","pub":"Hello.98","platform":"YouTube","value":150000},{"key":"Hello.98Th - FB","pub":"Hello.98Th","platform":"Facebook","value":150000},{"key":"Hello.98Th - X","pub":"Hello.98Th","platform":"X","value":150000},{"key":"Hello.98Th - YT","pub":"Hello.98Th","platform":"YouTube","value":150000},{"key":"Helloasianweb - FB","pub":"Helloasianweb","platform":"Facebook","value":150000},{"key":"Hellomagazine - FB","pub":"Hellomagazine","platform":"Facebook","value":360000},{"key":"Hellomagazine - IG","pub":"Hellomagazine","platform":"Instagram","value":360000},{"key":"Hellomagazine.com","pub":"Hellomagazine.com","platform":"Web","value":360000},{"key":"Hisopartyofficial.com","pub":"Hisopartyofficial.com","platform":"Web","value":210000},{"key":"Hizociety.com","pub":"Hizociety.com","platform":"Web","value":150000},{"key":"Homeandinnovation.com","pub":"Homeandinnovation.com","platform":"Web","value":150000},{"key":"Homeday.co.th","pub":"Homeday.co.th","platform":"Web","value":210000},{"key":"Hooninside.com","pub":"Hooninside.com","platform":"Web","value":210000},{"key":"Hot Progress Fanpage - FB","pub":"Hot Progress Fanpage","platform":"Facebook","value":150000},{"key":"Howe Magazine - FB","pub":"Howe Magazine","platform":"Facebook","value":150000},{"key":"Howe Magazine - X","pub":"Howe Magazine","platform":"X","value":150000},{"key":"Howemagazine.com","pub":"Howemagazine.com","platform":"Web","value":150000},{"key":"Hunsa - FB","pub":"Hunsa","platform":"Facebook","value":360000},{"key":"Hunsa - Tiktok","pub":"Hunsa","platform":"TikTok","value":360000},{"key":"Hunsa - YT","pub":"Hunsa","platform":"YouTube","value":360000},{"key":"Hunsa-com.blogspot.com","pub":"Hunsa-com.blogspot.com","platform":"Web","value":360000},{"key":"Iameverything.Co - FB","pub":"Iameverything.Co","platform":"Facebook","value":150000},{"key":"Iameverything.Co - IG","pub":"Iameverything.Co","platform":"Instagram","value":150000},{"key":"Ibiznewsmedia.com","pub":"Ibiznewsmedia.com","platform":"Web","value":150000},{"key":"Ibusiness - FB","pub":"Ibusiness","platform":"Facebook","value":150000},{"key":"Ibusiness.co","pub":"Ibusiness.co","platform":"Web","value":150000},{"key":"Imm Mhee อิ่มหมี พากินพาเที่ยว - FB","pub":"Imm Mhee อิ่มหมี พากินพาเที่ยว","platform":"Facebook","value":210000},{"key":"In On Tour - FB","pub":"In On Tour","platform":"Facebook","value":150000},{"key":"Indyreport.com","pub":"Indyreport.com","platform":"Web","value":150000},{"key":"Inforlifetv - FB","pub":"Inforlifetv","platform":"Facebook","value":150000},{"key":"Inforlifetv.com","pub":"Inforlifetv.com","platform":"Web","value":150000},{"key":"Inn - X","pub":"Inn","platform":"X","value":210000},{"key":"Inn - YT","pub":"Inn","platform":"YouTube","value":150000},{"key":"Inn entertainment - FB","pub":"Inn entertainment","platform":"Facebook","value":210000},{"key":"Inn entertainment - LINE TODAY","pub":"Inn entertainment","platform":"LINE TODAY","value":210000},{"key":"Inn entertainment - YT","pub":"Inn entertainment","platform":"YouTube","value":210000},{"key":"Innews.com","pub":"Innews.com","platform":"Web","value":150000},{"key":"Innews.news","pub":"Innews.news","platform":"Web","value":150000},{"key":"Innewsthailand - FB","pub":"Innewsthailand","platform":"Facebook","value":150000},{"key":"Innewsthailand.com","pub":"Innewsthailand.com","platform":"Web","value":150000},{"key":"Innnew - LINE TODAY","pub":"Innnew","platform":"LINE TODAY","value":210000},{"key":"Innnews - FB","pub":"Innnews","platform":"Facebook","value":210000},{"key":"Innnews - LINE TODAY","pub":"Innnews","platform":"LINE TODAY","value":210000},{"key":"Innnews - X","pub":"Innnews","platform":"X","value":210000},{"key":"Innnews.co.th","pub":"Innnews.co.th","platform":"Web","value":210000},{"key":"Innomatter.com","pub":"Innomatter.com","platform":"Web","value":150000},{"key":"Inourhood.Th - IG","pub":"Inourhood.Th","platform":"Instagram","value":150000},{"key":"Insomnia.Scene - FB","pub":"Insomnia.Scene","platform":"Facebook","value":150000},{"key":"Insomnia.Scene - IG","pub":"Insomnia.Scene","platform":"Instagram","value":150000},{"key":"Insomnia.Scene - Tiktok","pub":"Insomnia.Scene","platform":"TikTok","value":150000},{"key":"Instagram.com - IG","pub":"Instagram.com","platform":"Instagram","value":150000},{"key":"Intrend news - FB","pub":"Intrend news","platform":"Facebook","value":150000},{"key":"Intv Channel - FB","pub":"Intv Channel","platform":"Facebook","value":150000},{"key":"Intv Channel - YT","pub":"Intv Channel","platform":"YouTube","value":150000},{"key":"Intvthai - FB","pub":"Intvthai","platform":"Facebook","value":150000},{"key":"Intvthai - YT","pub":"Intvthai","platform":"YouTube","value":150000},{"key":"Intvthai.com","pub":"Intvthai.com","platform":"Web","value":150000},{"key":"Inzpy - FB","pub":"Inzpy","platform":"Facebook","value":210000},{"key":"Inzpy - IG","pub":"Inzpy","platform":"Instagram","value":210000},{"key":"Inzpy.com","pub":"Inzpy.com","platform":"Web","value":210000},{"key":"Jeban - FB","pub":"Jeban","platform":"Facebook","value":360000},{"key":"Jeban - IG","pub":"Jeban","platform":"Instagram","value":360000},{"key":"Jeban - Tiktok","pub":"Jeban","platform":"TikTok","value":360000},{"key":"Jeban.com","pub":"Jeban.com","platform":"Web","value":360000},{"key":"Jeeddyhome - FB","pub":"Jeeddyhome","platform":"Facebook","value":150000},{"key":"Jeeddyhome - IG","pub":"Jeeddyhome","platform":"Instagram","value":150000},{"key":"Jeeddyhome - Tiktok","pub":"Jeeddyhome","platform":"TikTok","value":150000},{"key":"Jiggaban - FB","pub":"Jiggaban","platform":"Facebook","value":150000},{"key":"Jiggaban - YT","pub":"Jiggaban","platform":"YouTube","value":150000},{"key":"Jiggaban Alive - YT","pub":"Jiggaban Alive","platform":"YouTube","value":150000},{"key":"Jiranarong2 - IG","pub":"Jiranarong2","platform":"Instagram","value":210000},{"key":"Joinalifethailand.com","pub":"Joinalifethailand.com","platform":"Web","value":150000},{"key":"Journaljourney.me - IG","pub":"Journaljourney.me","platform":"Instagram","value":150000},{"key":"Journey All Around - FB","pub":"Journey All Around","platform":"Facebook","value":150000},{"key":"Kabsnooktuathai.com","pub":"Kabsnooktuathai.com","platform":"Web","value":150000},{"key":"Kaoupdate - FB","pub":"Kaoupdate","platform":"Facebook","value":150000},{"key":"Kaoupdate.com","pub":"Kaoupdate.com","platform":"Web","value":150000},{"key":"kara.ladykara - IG","pub":"kara.ladykara","platform":"Instagram","value":150000},{"key":"Kazz Magazine - FB","pub":"Kazz Magazine","platform":"Facebook","value":210000},{"key":"Kazz Magazine - X","pub":"Kazz Magazine","platform":"X","value":150000},{"key":"Kazz-magazine.com","pub":"Kazz-magazine.com","platform":"Web","value":150000},{"key":"Khaoja.com","pub":"Khaoja.com","platform":"Web","value":150000},{"key":"Khaosod - FB","pub":"Khaosod","platform":"Facebook","value":360000},{"key":"Khaosod - LINE TODAY","pub":"Khaosod","platform":"LINE TODAY","value":360000},{"key":"Khaosod.co.th","pub":"Khaosod.co.th","platform":"Web","value":360000},{"key":"khaosodenglish - FB","pub":"khaosodenglish","platform":"Facebook","value":360000},{"key":"khaosodenglish - X","pub":"khaosodenglish","platform":"X","value":360000},{"key":"khaosodenglish.com","pub":"khaosodenglish.com","platform":"Web","value":360000},{"key":"khem.khempong - IG","pub":"khem.khempong","platform":"Instagram","value":210000},{"key":"Kindconnext - FB","pub":"Kindconnext","platform":"Facebook","value":150000},{"key":"Kindconnext - IG","pub":"Kindconnext","platform":"Instagram","value":150000},{"key":"King Of T-Pop - FB","pub":"King Of T-Pop","platform":"Facebook","value":150000},{"key":"King Of T-Pop - X","pub":"King Of T-Pop","platform":"X","value":150000},{"key":"Kitchen&Home Magazine - FB","pub":"Kitchen&Home Magazine","platform":"Facebook","value":210000},{"key":"Kitchen&Home Magazine - IG","pub":"Kitchen&Home Magazine","platform":"Instagram","value":210000},{"key":"Kitchen&Home Magazine - LINE TODAY","pub":"Kitchen&Home Magazine","platform":"LINE TODAY","value":210000},{"key":"Kitchen&Home Magazine - Tiktok","pub":"Kitchen&Home Magazine","platform":"TikTok","value":210000},{"key":"Kitdeenews.com","pub":"Kitdeenews.com","platform":"Web","value":150000},{"key":"Komchadluek - LINE TODAY","pub":"Komchadluek","platform":"LINE TODAY","value":360000},{"key":"Komchadluek.net","pub":"Komchadluek.net","platform":"Web","value":360000},{"key":"Korkasaesettakij - FB","pub":"Korkasaesettakij","platform":"Facebook","value":150000},{"key":"Korkasaesettakij.com","pub":"Korkasaesettakij.com","platform":"Web","value":150000},{"key":"Korkasaesettakij.wordpress.com","pub":"Korkasaesettakij.wordpress.com","platform":"Web","value":150000},{"key":"LADY KARA - FB","pub":"LADY KARA","platform":"Facebook","value":150000},{"key":"Lady Society - FB","pub":"Lady Society","platform":"Facebook","value":150000},{"key":"Lady Society - YT","pub":"Lady Society","platform":"YouTube","value":150000},{"key":"Ladykara.Kara - FB","pub":"Ladykara.Kara","platform":"Facebook","value":150000},{"key":"Ladykara.Kara - IG","pub":"Ladykara.Kara","platform":"Instagram","value":150000},{"key":"Leadertoday.net","pub":"Leadertoday.net","platform":"Web","value":150000},{"key":"Lemon8-app.com","pub":"Lemon8-app.com","platform":"Web","value":210000},{"key":"Lensnews21.com","pub":"Lensnews21.com","platform":"Web","value":150000},{"key":"Let's Eat Thailand กินกับเดี่ยวเที่ยวกับมด","pub":"Let's Eat Thailand กินกับเดี่ยวเที่ยวกับมด","platform":"Web","value":210000},{"key":"Lifebiznews.com","pub":"Lifebiznews.com","platform":"Web","value":150000},{"key":"Lifestyle Asia Thailand - FB","pub":"Lifestyle Asia Thailand","platform":"Facebook","value":210000},{"key":"Lifestyle Asia Thailand [EN] - IG","pub":"Lifestyle Asia Thailand [EN]","platform":"Instagram","value":210000},{"key":"Lifestyleasia.com","pub":"Lifestyleasia.com","platform":"Web","value":210000},{"key":"Lifestyleasiath - IG","pub":"Lifestyleasiath","platform":"Instagram","value":210000},{"key":"Lifetimemags.com","pub":"Lifetimemags.com","platform":"Web","value":150000},{"key":"LIPS MAGAZINE - FB","pub":"LIPS MAGAZINE","platform":"Facebook","value":210000},{"key":"LIPS MAGAZINE - IG","pub":"LIPS MAGAZINE","platform":"Instagram","value":210000},{"key":"Livary - FB","pub":"Livary","platform":"Facebook","value":150000},{"key":"Livary - IG","pub":"Livary","platform":"Instagram","value":150000},{"key":"Livary.bangkok - FB","pub":"Livary.bangkok","platform":"Facebook","value":150000},{"key":"Livary.bangkok - IG","pub":"Livary.bangkok","platform":"Instagram","value":150000},{"key":"Livary.bangkok - Tiktok","pub":"Livary.bangkok","platform":"TikTok","value":150000},{"key":"Live To Life - FB","pub":"Live To Life","platform":"Facebook","value":150000},{"key":"Livetolife.com","pub":"Livetolife.com","platform":"Web","value":150000},{"key":"Living Sneak Peek - FB","pub":"Living Sneak Peek","platform":"Facebook","value":210000},{"key":"Livingsneakpeek.com","pub":"Livingsneakpeek.com","platform":"Web","value":210000},{"key":"Lnhabits - FB","pub":"Lnhabits","platform":"Facebook","value":150000},{"key":"Lokwannee.com","pub":"Lokwannee.com","platform":"Web","value":210000},{"key":"Look At Art เสพงานศิลป์ - FB","pub":"Look At Art เสพงานศิลป์","platform":"Facebook","value":150000},{"key":"LookAround TH - FB","pub":"LookAround TH","platform":"Facebook","value":150000},{"key":"LookAround TH - IG","pub":"LookAround TH","platform":"Instagram","value":150000},{"key":"LookAround TH - X","pub":"LookAround TH","platform":"X","value":150000},{"key":"Lookaround-th.com","pub":"Lookaround-th.com","platform":"Web","value":150000},{"key":"Lookermag - IG","pub":"Lookermag","platform":"Instagram","value":210000},{"key":"Louderisan - FB","pub":"Louderisan","platform":"Facebook","value":150000},{"key":"Louderisan - IG","pub":"Louderisan","platform":"Instagram","value":150000},{"key":"Louderisan - Tiktok","pub":"Louderisan","platform":"TikTok","value":150000},{"key":"Madamemount - FB","pub":"Madamemount","platform":"Facebook","value":150000},{"key":"Madamemount.com","pub":"Madamemount.com","platform":"Web","value":150000},{"key":"Maeban.co.th","pub":"Maeban.co.th","platform":"Web","value":210000},{"key":"Maganetthailand - FB","pub":"Maganetthailand","platform":"Facebook","value":150000},{"key":"Maganetthailand - X","pub":"Maganetthailand","platform":"X","value":150000},{"key":"Maganetthailand - YT","pub":"Maganetthailand","platform":"YouTube","value":150000},{"key":"Maganetthailand.Com - FB","pub":"Maganetthailand.Com","platform":"Facebook","value":150000},{"key":"Main.bangkok.go.th","pub":"Main.bangkok.go.th","platform":"Web","value":210000},{"key":"Manager 360 Magazine - FB","pub":"Manager 360 Magazine","platform":"Facebook","value":210000},{"key":"Mango Zero - FB","pub":"Mango Zero","platform":"Facebook","value":210000},{"key":"Mango Zero - IG","pub":"Mango Zero","platform":"Instagram","value":210000},{"key":"Mango Zero - Tiktok","pub":"Mango Zero","platform":"TikTok","value":210000},{"key":"Marketeer - FB","pub":"Marketeer","platform":"Facebook","value":360000},{"key":"Marketeer - X","pub":"Marketeer","platform":"X","value":360000},{"key":"Marketeeronline - FB","pub":"Marketeeronline","platform":"Facebook","value":360000},{"key":"Marketeeronline.com","pub":"Marketeeronline.com","platform":"Web","value":360000},{"key":"Marketingoops - FB","pub":"Marketingoops","platform":"Facebook","value":210000},{"key":"Marketingoops.com","pub":"Marketingoops.com","platform":"Web","value":210000},{"key":"Marketplus.in.th","pub":"Marketplus.in.th","platform":"Web","value":210000},{"key":"Marketthink - BD","pub":"Marketthink","platform":"BD","value":210000},{"key":"Marketthink - FB","pub":"Marketthink","platform":"Facebook","value":210000},{"key":"Marketthink - X","pub":"Marketthink","platform":"X","value":210000},{"key":"Marketthink.co","pub":"Marketthink.co","platform":"Web","value":210000},{"key":"Mashare.Review - Tiktok","pub":"Mashare.Review","platform":"TikTok","value":150000},{"key":"Matichon - FB","pub":"Matichon","platform":"Facebook","value":360000},{"key":"Matichon - LINE TODAY","pub":"Matichon","platform":"LINE TODAY","value":360000},{"key":"Matichon.co.th","pub":"Matichon.co.th","platform":"Web","value":360000},{"key":"Matichonweekly.com","pub":"Matichonweekly.com","platform":"Web","value":210000},{"key":"Maya Tv - FB","pub":"Maya Tv","platform":"Facebook","value":150000},{"key":"Maya Tv - X","pub":"Maya Tv","platform":"X","value":150000},{"key":"Maya Tv - YT","pub":"Maya Tv","platform":"YouTube","value":150000},{"key":"Maya Tv Official - X","pub":"Maya Tv Official","platform":"X","value":210000},{"key":"Mbamagazine.net","pub":"Mbamagazine.net","platform":"Web","value":150000},{"key":"Mbt-post.com","pub":"Mbt-post.com","platform":"Web","value":150000},{"key":"Mcot ทั่วไทย - FB","pub":"Mcot ทั่วไทย","platform":"Facebook","value":210000},{"key":"Mekhanews.com","pub":"Mekhanews.com","platform":"Web","value":150000},{"key":"Memosmile - FB","pub":"Memosmile","platform":"Facebook","value":150000},{"key":"Memosmile - IG","pub":"Memosmile","platform":"Instagram","value":150000},{"key":"Memosmile - Tiktok","pub":"Memosmile","platform":"TikTok","value":150000},{"key":"Meonlinemag.com","pub":"Meonlinemag.com","platform":"Web","value":150000},{"key":"Mgronline - LINE TODAY","pub":"Mgronline","platform":"LINE TODAY","value":360000},{"key":"Mgronline.com","pub":"Mgronline.com","platform":"Web","value":360000},{"key":"Mileday365.com","pub":"Mileday365.com","platform":"Web","value":150000},{"key":"Minimeinsights - X","pub":"Minimeinsights","platform":"X","value":150000},{"key":"Minimeinsights.com","pub":"Minimeinsights.com","platform":"Web","value":150000},{"key":"Mint Magazine Thailand - FB","pub":"Mint Magazine Thailand","platform":"Facebook","value":210000},{"key":"Mint.nisara - IG","pub":"Mint.nisara","platform":"Instagram","value":150000},{"key":"Mintmagth.com","pub":"Mintmagth.com","platform":"Web","value":210000},{"key":"Mitihoon.com","pub":"Mitihoon.com","platform":"Web","value":150000},{"key":"Mitikhao.com","pub":"Mitikhao.com","platform":"Web","value":150000},{"key":"Mixmagazine.in.th","pub":"Mixmagazine.in.th","platform":"Web","value":210000},{"key":"Monderlust. : Travel / Snap / Cafehopping - FB","pub":"Monderlust. : Travel / Snap / Cafehopping","platform":"Facebook","value":150000},{"key":"Moneylifenews.com","pub":"Moneylifenews.com","platform":"Web","value":150000},{"key":"Mono29.com","pub":"Mono29.com","platform":"Web","value":360000},{"key":"Monstermag - FB","pub":"Monstermag","platform":"Facebook","value":150000},{"key":"Monstermag - IG","pub":"Monstermag","platform":"Instagram","value":150000},{"key":"Monstermag - Tiktok","pub":"Monstermag","platform":"TikTok","value":150000},{"key":"Motoroops.com","pub":"Motoroops.com","platform":"Web","value":150000},{"key":"Move24 Bangkok - FB","pub":"Move24 Bangkok","platform":"Facebook","value":150000},{"key":"Moveideas.me","pub":"Moveideas.me","platform":"Web","value":150000},{"key":"MPlay Entertrainment - FB","pub":"MPlay Entertrainment","platform":"Facebook","value":150000},{"key":"MPlay Entertrainment","pub":"MPlay Entertrainment","platform":"Web","value":150000},{"key":"MPlay Entertrainment  - X","pub":"MPlay Entertrainment","platform":"X","value":150000},{"key":"Mplay_Entertainment - X","pub":"Mplay_Entertainment","platform":"X","value":150000},{"key":"Mrbadboygo.Art - FB","pub":"Mrbadboygo.Art","platform":"Facebook","value":150000},{"key":"Mrbadboygo.com","pub":"Mrbadboygo.com","platform":"Web","value":150000},{"key":"Mthai.com","pub":"Mthai.com","platform":"Web","value":360000},{"key":"Musicandartmag.com","pub":"Musicandartmag.com","platform":"Web","value":150000},{"key":"Mutual  - FB","pub":"Mutual","platform":"Facebook","value":150000},{"key":"Mutual  - IG","pub":"Mutual","platform":"Instagram","value":150000},{"key":"Naewna.com","pub":"Naewna.com","platform":"Web","value":360000},{"key":"Namwanp - IG","pub":"Namwanp","platform":"Instagram","value":210000},{"key":"Natethip.com","pub":"Natethip.com","platform":"Web","value":150000},{"key":"NationPhoto - FB","pub":"NationPhoto","platform":"Facebook","value":210000},{"key":"Nationthailand.com","pub":"Nationthailand.com","platform":"Web","value":210000},{"key":"Nationtv.tv","pub":"Nationtv.tv","platform":"Web","value":210000},{"key":"NBT - Tiktok","pub":"NBT","platform":"TikTok","value":210000},{"key":"NBT - YT","pub":"NBT","platform":"YouTube","value":210000},{"key":"Nbt World - FB","pub":"Nbt World","platform":"Facebook","value":210000},{"key":"Nbt World - IG","pub":"Nbt World","platform":"Instagram","value":210000},{"key":"Nbt World - X","pub":"Nbt World","platform":"X","value":210000},{"key":"Nbt World - YT","pub":"Nbt World","platform":"YouTube","value":210000},{"key":"Neeeeed.co - IG","pub":"Neeeeed.co","platform":"Instagram","value":150000},{"key":"News bunterng - FB","pub":"News bunterng","platform":"Facebook","value":150000},{"key":"News bunterng - IG","pub":"News bunterng","platform":"Instagram","value":150000},{"key":"News bunterng  - YT","pub":"News bunterng","platform":"YouTube","value":150000},{"key":"News Time Online - FB","pub":"News Time Online","platform":"Facebook","value":150000},{"key":"News U - FB","pub":"News U","platform":"Facebook","value":150000},{"key":"News U - X","pub":"News U","platform":"X","value":150000},{"key":"News Update - FB","pub":"News Update","platform":"Facebook","value":150000},{"key":"News Way Entertainment - FB","pub":"News Way Entertainment","platform":"Facebook","value":150000},{"key":"News Way Entertainment - X","pub":"News Way Entertainment","platform":"X","value":150000},{"key":"News1live.com","pub":"News1live.com","platform":"Web","value":210000},{"key":"Newsdatatoday.com","pub":"Newsdatatoday.com","platform":"Web","value":150000},{"key":"Newsdirectory3.com","pub":"Newsdirectory3.com","platform":"Web","value":360000},{"key":"Newslive-thailand.com","pub":"Newslive-thailand.com","platform":"Web","value":150000},{"key":"Newsplus - FB","pub":"Newsplus","platform":"Facebook","value":210000},{"key":"Newsplus - X","pub":"Newsplus","platform":"X","value":210000},{"key":"Newsplus - YT","pub":"Newsplus","platform":"YouTube","value":210000},{"key":"Newsplus.co.th","pub":"Newsplus.co.th","platform":"Web","value":210000},{"key":"Newstimestory - FB","pub":"Newstimestory","platform":"Facebook","value":150000},{"key":"Newstimestory - Tiktok","pub":"Newstimestory","platform":"TikTok","value":150000},{"key":"Newstimestory.com","pub":"Newstimestory.com","platform":"Web","value":150000},{"key":"Newswayent - Tiktok","pub":"Newswayent","platform":"TikTok","value":150000},{"key":"Newswit.com","pub":"Newswit.com","platform":"Web","value":150000},{"key":"Newszociety.com","pub":"Newszociety.com","platform":"Web","value":150000},{"key":"Nineentertain - FB","pub":"Nineentertain","platform":"Facebook","value":360000},{"key":"Nineentertain - YT","pub":"Nineentertain","platform":"YouTube","value":360000},{"key":"Nineentertain official - YT","pub":"Nineentertain official","platform":"YouTube","value":360000},{"key":"Nineentertain.mcot.net","pub":"Nineentertain.mcot.net","platform":"Web","value":360000},{"key":"Nowentertain - FB","pub":"Nowentertain","platform":"Facebook","value":150000},{"key":"Nylonthailand - FB","pub":"Nylonthailand","platform":"Facebook","value":210000},{"key":"Nylonthailand - IG","pub":"Nylonthailand","platform":"Instagram","value":210000},{"key":"Nylonthailand - Tiktok","pub":"Nylonthailand","platform":"TikTok","value":210000},{"key":"Oatkomkrich - FB","pub":"Oatkomkrich","platform":"Facebook","value":150000},{"key":"Oatkomkrich - IG","pub":"Oatkomkrich","platform":"Instagram","value":150000},{"key":"Ody-News - FB","pub":"Ody-News","platform":"Facebook","value":150000},{"key":"Ody-News - YT","pub":"Ody-News","platform":"YouTube","value":150000},{"key":"Ody-news.com","pub":"Ody-news.com","platform":"Web","value":150000},{"key":"Ohlalastory - FB","pub":"Ohlalastory","platform":"Facebook","value":210000},{"key":"Ohlalastory.com","pub":"Ohlalastory.com","platform":"Web","value":210000},{"key":"Once - FB","pub":"Once","platform":"Facebook","value":150000},{"key":"Once - IG","pub":"Once","platform":"Instagram","value":150000},{"key":"Once - Tiktok","pub":"Once","platform":"TikTok","value":150000},{"key":"Onceinlife.Co - IG","pub":"Onceinlife.Co","platform":"Instagram","value":150000},{"key":"One More Course - FB","pub":"One More Course","platform":"Facebook","value":210000},{"key":"One Next Class - FB","pub":"One Next Class","platform":"Facebook","value":150000},{"key":"One Next Class - IG","pub":"One Next Class","platform":"Instagram","value":150000},{"key":"One Next Class - X","pub":"One Next Class","platform":"X","value":150000},{"key":"One Next Class ชีวิตติดเรียนรู้ - FB","pub":"One Next Class ชีวิตติดเรียนรู้","platform":"Facebook","value":150000},{"key":"Onedeedee - FB","pub":"Onedeedee","platform":"Facebook","value":150000},{"key":"Onedeedee.com","pub":"Onedeedee.com","platform":"Web","value":150000},{"key":"Onlinenewstime.com","pub":"Onlinenewstime.com","platform":"Web","value":150000},{"key":"Onmag.Th - X","pub":"Onmag.Th","platform":"X","value":150000},{"key":"OOPS! DELISH - FB","pub":"OOPS! DELISH","platform":"Facebook","value":210000},{"key":"Otpc News - FB","pub":"Otpc News","platform":"Facebook","value":150000},{"key":"Otpc News - X","pub":"Otpc News","platform":"X","value":150000},{"key":"Otpc News - YT","pub":"Otpc News","platform":"YouTube","value":150000},{"key":"Otpc News - YT - YT","pub":"Otpc News - YT","platform":"YouTube","value":150000},{"key":"Otpc Story - FB","pub":"Otpc Story","platform":"Facebook","value":150000},{"key":"Otpc Story - X","pub":"Otpc Story","platform":"X","value":150000},{"key":"Packaging Magazine - FB","pub":"Packaging Magazine","platform":"Facebook","value":150000},{"key":"PaikubPro : ไปกับโปร - FB","pub":"PaikubPro : ไปกับโปร","platform":"Facebook","value":150000},{"key":"Paikubpro.com","pub":"Paikubpro.com","platform":"Web","value":150000},{"key":"Pam Yanisa - FB","pub":"Pam Yanisa","platform":"Facebook","value":210000},{"key":"Pam Yanisa - IG","pub":"Pam Yanisa","platform":"Instagram","value":210000},{"key":"Patchy66  - IG","pub":"Patchy66","platform":"Instagram","value":150000},{"key":"Pepperthailand - IG","pub":"Pepperthailand","platform":"Instagram","value":210000},{"key":"Petitegomez - IG","pub":"Petitegomez","platform":"Instagram","value":210000},{"key":"Phigudkhaow - FB","pub":"Phigudkhaow","platform":"Facebook","value":150000},{"key":"Phigudkhaow.com","pub":"Phigudkhaow.com","platform":"Web","value":150000},{"key":"Pineapplenewsagency - X","pub":"Pineapplenewsagency","platform":"X","value":150000},{"key":"Pineapplenewsagency.com","pub":"Pineapplenewsagency.com","platform":"Web","value":150000},{"key":"Places Two Go - FB","pub":"Places Two Go","platform":"Facebook","value":210000},{"key":"Places Two Go - IG","pub":"Places Two Go","platform":"Instagram","value":210000},{"key":"Places Two Go - Tiktok","pub":"Places Two Go","platform":"TikTok","value":210000},{"key":"Places Two Go - X","pub":"Places Two Go","platform":"X","value":210000},{"key":"Plewseengern.com","pub":"Plewseengern.com","platform":"Web","value":210000},{"key":"Plus.thairath.co.th","pub":"Plus.thairath.co.th","platform":"Web","value":360000},{"key":"Pooyingnaka.com","pub":"Pooyingnaka.com","platform":"Web","value":150000},{"key":"Popconth - FB","pub":"Popconth","platform":"Facebook","value":150000},{"key":"Popconth - IG","pub":"Popconth","platform":"Instagram","value":150000},{"key":"Popconth - Tiktok","pub":"Popconth","platform":"TikTok","value":150000},{"key":"Popconth - X","pub":"Popconth","platform":"X","value":150000},{"key":"Posh Magazine Thailand - FB","pub":"Posh Magazine Thailand","platform":"Facebook","value":210000},{"key":"Posh Magazine Thailand - IG","pub":"Posh Magazine Thailand","platform":"Instagram","value":210000},{"key":"Positioning - FB","pub":"Positioning","platform":"Facebook","value":360000},{"key":"Positioningmag - FB","pub":"Positioningmag","platform":"Facebook","value":360000},{"key":"Positioningmag - LINE TODAY","pub":"Positioningmag","platform":"LINE TODAY","value":360000},{"key":"Positioningmag - X","pub":"Positioningmag","platform":"X","value":360000},{"key":"Positioningmag.com","pub":"Positioningmag.com","platform":"Web","value":360000},{"key":"Posttoday - FB","pub":"Posttoday","platform":"Facebook","value":360000},{"key":"Posttoday - X","pub":"Posttoday","platform":"X","value":360000},{"key":"Posttoday.com","pub":"Posttoday.com","platform":"Web","value":360000},{"key":"Powertimetoday.com","pub":"Powertimetoday.com","platform":"Web","value":150000},{"key":"PPTV บันเทิง - FB","pub":"PPTV บันเทิง","platform":"Facebook","value":360000},{"key":"Pptvhd36 - FB","pub":"Pptvhd36","platform":"Facebook","value":210000},{"key":"Pptvhd36 - LINE TODAY","pub":"Pptvhd36","platform":"LINE TODAY","value":210000},{"key":"Pptvhd36.com","pub":"Pptvhd36.com","platform":"Web","value":210000},{"key":"Pr Jipata All-Stars Magazine - FB","pub":"Pr Jipata All-Stars Magazine","platform":"Facebook","value":150000},{"key":"Pr Jipata All-Stars Magazine - X","pub":"Pr Jipata All-Stars Magazine","platform":"X","value":150000},{"key":"Prachachat - FB","pub":"Prachachat","platform":"Facebook","value":360000},{"key":"Prachachat - Line","pub":"Prachachat","platform":"LINE","value":360000},{"key":"Prachachat - LINE TODAY","pub":"Prachachat","platform":"LINE TODAY","value":360000},{"key":"Prachachat - X","pub":"Prachachat","platform":"X","value":360000},{"key":"Prachachat.net","pub":"Prachachat.net","platform":"Web","value":360000},{"key":"Praew.com","pub":"Praew.com","platform":"Web","value":360000},{"key":"Prakan News - FB","pub":"Prakan News","platform":"Facebook","value":150000},{"key":"Prfreeonline.com","pub":"Prfreeonline.com","platform":"Web","value":150000},{"key":"Prjipata - FB","pub":"Prjipata","platform":"Facebook","value":150000},{"key":"Prjipata - X","pub":"Prjipata","platform":"X","value":150000},{"key":"Prjipata.com","pub":"Prjipata.com","platform":"Web","value":150000},{"key":"Prohubpromotion - FB","pub":"Prohubpromotion","platform":"Facebook","value":210000},{"key":"Prohubpromotion - IG","pub":"Prohubpromotion","platform":"Instagram","value":210000},{"key":"Prohubpromotion - Tiktok","pub":"Prohubpromotion","platform":"TikTok","value":210000},{"key":"Prop&travel - FB","pub":"Prop&travel","platform":"Facebook","value":150000},{"key":"Prop2morrow - FB","pub":"Prop2morrow","platform":"Facebook","value":210000},{"key":"Prop2morrow.com","pub":"Prop2morrow.com","platform":"Web","value":210000},{"key":"Propdna.net","pub":"Propdna.net","platform":"Web","value":150000},{"key":"Propertychannel.co.th","pub":"Propertychannel.co.th","platform":"Web","value":150000},{"key":"Propholic - FB","pub":"Propholic","platform":"Facebook","value":210000},{"key":"Propholic.com","pub":"Propholic.com","platform":"Web","value":210000},{"key":"Proxumer - FB","pub":"Proxumer","platform":"Facebook","value":360000},{"key":"Proxumer - IG","pub":"Proxumer","platform":"Instagram","value":360000},{"key":"Proxumer - X","pub":"Proxumer","platform":"X","value":360000},{"key":"Prsociety - FB","pub":"Prsociety","platform":"Facebook","value":150000},{"key":"Prsociety - X","pub":"Prsociety","platform":"X","value":150000},{"key":"Prsociety.net","pub":"Prsociety.net","platform":"Web","value":150000},{"key":"Publicpostonline.net","pub":"Publicpostonline.net","platform":"Web","value":150000},{"key":"Punpro24 - FB","pub":"Punpro24","platform":"Facebook","value":360000},{"key":"Punpromotion - IG","pub":"Punpromotion","platform":"Instagram","value":360000},{"key":"Punpromotion - X","pub":"Punpromotion","platform":"X","value":360000},{"key":"Questionmark.th - IG","pub":"Questionmark.th","platform":"Instagram","value":150000},{"key":"Readthecloud.Co - IG","pub":"Readthecloud.Co","platform":"Instagram","value":210000},{"key":"Real Ent. - FB","pub":"Real Ent.","platform":"Facebook","value":150000},{"key":"Realist - FB","pub":"Realist","platform":"Facebook","value":210000},{"key":"Review By O - Tiktok","pub":"Review By O","platform":"TikTok","value":210000},{"key":"Room Books - FB","pub":"Room Books","platform":"Facebook","value":210000},{"key":"Room Books - X","pub":"Room Books","platform":"X","value":210000},{"key":"Round.Finger.Review - FB","pub":"Round.Finger.Review","platform":"Facebook","value":210000},{"key":"Round.Finger.Review - IG","pub":"Round.Finger.Review","platform":"Instagram","value":210000},{"key":"Routeen - FB","pub":"Routeen","platform":"Facebook","value":210000},{"key":"Routeen - IG","pub":"Routeen","platform":"Instagram","value":210000},{"key":"Routeen - Lemon8","pub":"Routeen","platform":"Lemon8","value":210000},{"key":"Routeen - X","pub":"Routeen","platform":"X","value":210000},{"key":"Routeen.Co - FB","pub":"Routeen.Co","platform":"Facebook","value":210000},{"key":"Routeen.Co - IG","pub":"Routeen.Co","platform":"Instagram","value":210000},{"key":"Routeen.Co - X","pub":"Routeen.Co","platform":"X","value":210000},{"key":"Rubberplasmedia.com","pub":"Rubberplasmedia.com","platform":"Web","value":150000},{"key":"Ryt9.com","pub":"Ryt9.com","platform":"Web","value":150000},{"key":"Ryuisnow - YT","pub":"Ryuisnow","platform":"YouTube","value":150000},{"key":"Sale Here - FB","pub":"Sale Here","platform":"Facebook","value":360000},{"key":"Sale Here - IG","pub":"Sale Here","platform":"Instagram","value":360000},{"key":"Sale Here - Tiktok","pub":"Sale Here","platform":"TikTok","value":360000},{"key":"Sale Here - X","pub":"Sale Here","platform":"X","value":360000},{"key":"Sampasjai กิจกรรมเรียนรู้ดูแลจิตใจ - FB","pub":"Sampasjai กิจกรรมเรียนรู้ดูแลจิตใจ","platform":"Facebook","value":150000},{"key":"Sanook - FB","pub":"Sanook","platform":"Facebook","value":360000},{"key":"Sanook - IG","pub":"Sanook","platform":"Instagram","value":360000},{"key":"Sanook - Tiktok","pub":"Sanook","platform":"TikTok","value":360000},{"key":"Sanook - X","pub":"Sanook","platform":"X","value":360000},{"key":"Sanook.com","pub":"Sanook.com","platform":"Web","value":360000},{"key":"Sarakadee Lite - FB","pub":"Sarakadee Lite","platform":"Facebook","value":210000},{"key":"Sarakadee Lite - IG","pub":"Sarakadee Lite","platform":"Instagram","value":210000},{"key":"Sarakadee Lite - LINE TODAY","pub":"Sarakadee Lite","platform":"LINE TODAY","value":210000},{"key":"Sarakadee Lite - Tiktok","pub":"Sarakadee Lite","platform":"TikTok","value":210000},{"key":"Sarakadee Lite - X","pub":"Sarakadee Lite","platform":"X","value":210000},{"key":"Sarakadee magazine - FB","pub":"Sarakadee magazine","platform":"Facebook","value":210000},{"key":"Sarakadeelite.com","pub":"Sarakadeelite.com","platform":"Web","value":210000},{"key":"Sattahip.net","pub":"Sattahip.net","platform":"Web","value":150000},{"key":"Scala News - X","pub":"Scala News","platform":"X","value":150000},{"key":"Secret News - FB","pub":"Secret News","platform":"Facebook","value":150000},{"key":"Secret News - X","pub":"Secret News","platform":"X","value":150000},{"key":"Secret News - YT","pub":"Secret News","platform":"YouTube","value":150000},{"key":"Secret Styled - IG","pub":"Secret Styled","platform":"Instagram","value":150000},{"key":"Secret Styled - Tiktok","pub":"Secret Styled","platform":"TikTok","value":150000},{"key":"Secret Styled - X","pub":"Secret Styled","platform":"X","value":150000},{"key":"Sentangsedtee - FB","pub":"Sentangsedtee","platform":"Facebook","value":210000},{"key":"Siam108.com","pub":"Siam108.com","platform":"Web","value":150000},{"key":"Siamevent.com","pub":"Siamevent.com","platform":"Web","value":150000},{"key":"Siamlandbank.com","pub":"Siamlandbank.com","platform":"Web","value":150000},{"key":"Siamrath - FB","pub":"Siamrath","platform":"Facebook","value":210000},{"key":"Siamrath - LINE TODAY","pub":"Siamrath","platform":"LINE TODAY","value":210000},{"key":"Siamrath - X","pub":"Siamrath","platform":"X","value":210000},{"key":"Siamrath.co.th","pub":"Siamrath.co.th","platform":"Web","value":210000},{"key":"Siamrathnews - LINE TODAY","pub":"Siamrathnews","platform":"LINE TODAY","value":360000},{"key":"Siamrathnews.com","pub":"Siamrathnews.com","platform":"Web","value":210000},{"key":"Siamsport.co.th","pub":"Siamsport.co.th","platform":"Web","value":210000},{"key":"Siamturakij.com","pub":"Siamturakij.com","platform":"Web","value":210000},{"key":"Silpthou-ศิลป์เทา - FB","pub":"Silpthou-ศิลป์เทา","platform":"Facebook","value":150000},{"key":"Sinehabangkok - FB","pub":"Sinehabangkok","platform":"Facebook","value":150000},{"key":"Sinehabangkok - IG","pub":"Sinehabangkok","platform":"Instagram","value":150000},{"key":"Sinehabangkok  - Tiktok","pub":"Sinehabangkok","platform":"TikTok","value":150000},{"key":"Singha Experience - FB","pub":"Singha Experience","platform":"Facebook","value":150000},{"key":"Sistacafe - FB","pub":"Sistacafe","platform":"Facebook","value":360000},{"key":"Sistacafe - X","pub":"Sistacafe","platform":"X","value":360000},{"key":"Sistacafe.com","pub":"Sistacafe.com","platform":"Web","value":360000},{"key":"Slimmingthai.com","pub":"Slimmingthai.com","platform":"Web","value":150000},{"key":"Smartlife-news.com","pub":"Smartlife-news.com","platform":"Web","value":150000},{"key":"Smmagonline.com","pub":"Smmagonline.com","platform":"Web","value":150000},{"key":"Sniffaround - FB","pub":"Sniffaround","platform":"Facebook","value":150000},{"key":"Sniffaround - IG","pub":"Sniffaround","platform":"Instagram","value":150000},{"key":"Soimilk - FB","pub":"Soimilk","platform":"Facebook","value":210000},{"key":"Soimilk - IG","pub":"Soimilk","platform":"Instagram","value":210000},{"key":"Soimilk.com","pub":"Soimilk.com","platform":"Web","value":210000},{"key":"Soimilkbangkok - IG","pub":"Soimilkbangkok","platform":"Instagram","value":210000},{"key":"Sondhitalk.com","pub":"Sondhitalk.com","platform":"Web","value":150000},{"key":"Sootinclaimon - FB","pub":"Sootinclaimon","platform":"Facebook","value":150000},{"key":"Sootinclaimon.com","pub":"Sootinclaimon.com","platform":"Web","value":150000},{"key":"Soul4Street - FB","pub":"Soul4Street","platform":"Facebook","value":210000},{"key":"Soul4Street - IG","pub":"Soul4Street","platform":"Instagram","value":210000},{"key":"Spacebar VIBE - FB","pub":"Spacebar VIBE","platform":"Facebook","value":150000},{"key":"Spacebar.th","pub":"Spacebar.th","platform":"Web","value":150000},{"key":"Spice - FB","pub":"Spice","platform":"Facebook","value":360000},{"key":"Spicethailand - FB","pub":"Spicethailand","platform":"Facebook","value":360000},{"key":"Spicethailand - IG","pub":"Spicethailand","platform":"Instagram","value":360000},{"key":"Spicethailand - Tiktok","pub":"Spicethailand","platform":"TikTok","value":360000},{"key":"Spicydisc - FB","pub":"Spicydisc","platform":"Facebook","value":210000},{"key":"Splendor-Biz - FB","pub":"Splendor-Biz","platform":"Facebook","value":150000},{"key":"Splendor-biz.com","pub":"Splendor-biz.com","platform":"Web","value":150000},{"key":"Split Th - FB","pub":"Split Th","platform":"Facebook","value":150000},{"key":"Split Th - IG","pub":"Split Th","platform":"Instagram","value":150000},{"key":"Spotlight - FB","pub":"Spotlight","platform":"Facebook","value":210000},{"key":"Spotlight Daily - FB","pub":"Spotlight Daily","platform":"Facebook","value":150000},{"key":"Spotlightdaily.net","pub":"Spotlightdaily.net","platform":"Web","value":150000},{"key":"Spreadsbkk - FB","pub":"Spreadsbkk","platform":"Facebook","value":150000},{"key":"Spreadsbkk - IG","pub":"Spreadsbkk","platform":"Instagram","value":150000},{"key":"Spring News - LINE TODAY","pub":"Spring News","platform":"LINE TODAY","value":210000},{"key":"Spring News - YT","pub":"Spring News","platform":"YouTube","value":210000},{"key":"Springnews.co.th","pub":"Springnews.co.th","platform":"Web","value":210000},{"key":"Stageonleader.com","pub":"Stageonleader.com","platform":"Web","value":150000},{"key":"Star Society - FB","pub":"Star Society","platform":"Facebook","value":150000},{"key":"Star Society - X","pub":"Star Society","platform":"X","value":150000},{"key":"Star2day - FB","pub":"Star2day","platform":"Facebook","value":150000},{"key":"StarDeligh - X","pub":"StarDeligh","platform":"X","value":150000},{"key":"StarDeligh - YT","pub":"StarDeligh","platform":"YouTube","value":150000},{"key":"Stardelight - FB","pub":"Stardelight","platform":"Facebook","value":150000},{"key":"Stardelight - X","pub":"Stardelight","platform":"X","value":150000},{"key":"Starlight Ynews - FB","pub":"Starlight Ynews","platform":"Facebook","value":150000},{"key":"Starlight Ynews - X","pub":"Starlight Ynews","platform":"X","value":150000},{"key":"Starlight Ynews - YT","pub":"Starlight Ynews","platform":"YouTube","value":150000},{"key":"Startalk Entertainment - FB","pub":"Startalk Entertainment","platform":"Facebook","value":150000},{"key":"Startalk Entertainment - X","pub":"Startalk Entertainment","platform":"X","value":150000},{"key":"Starupdate - FB","pub":"Starupdate","platform":"Facebook","value":150000},{"key":"Starupdate - X","pub":"Starupdate","platform":"X","value":150000},{"key":"Starupdate - YT","pub":"Starupdate","platform":"YouTube","value":150000},{"key":"Starupdate.Com","pub":"Starupdate.Com","platform":"Web","value":150000},{"key":"Starupdate.Com - X","pub":"Starupdate.Com","platform":"X","value":150000},{"key":"Starupdatedot - FB","pub":"Starupdatedot","platform":"Facebook","value":150000},{"key":"Starupdatedotcom - FB","pub":"Starupdatedotcom","platform":"Facebook","value":150000},{"key":"Starupdatedotcom - X","pub":"Starupdatedotcom","platform":"X","value":150000},{"key":"Starvingtime เรื่องกินเรื่องใหญ่ - FB","pub":"Starvingtime เรื่องกินเรื่องใหญ่","platform":"Facebook","value":360000},{"key":"Successchannel - FB","pub":"Successchannel","platform":"Facebook","value":150000},{"key":"Successchannel - IG","pub":"Successchannel","platform":"Instagram","value":150000},{"key":"Successchannel  - X","pub":"Successchannel","platform":"X","value":150000},{"key":"Successchannel.com","pub":"Successchannel.com","platform":"Web","value":150000},{"key":"Sudsapda - FB","pub":"Sudsapda","platform":"Facebook","value":360000},{"key":"Sudsapda - IG","pub":"Sudsapda","platform":"Instagram","value":360000},{"key":"Sudsapda - Tiktok","pub":"Sudsapda","platform":"TikTok","value":360000},{"key":"Sudsapda.com","pub":"Sudsapda.com","platform":"Web","value":360000},{"key":"Sum up - FB","pub":"Sum up","platform":"Facebook","value":150000},{"key":"Sumupth.com","pub":"Sumupth.com","platform":"Web","value":150000},{"key":"Super Scene - FB","pub":"Super Scene","platform":"Facebook","value":150000},{"key":"Super Scene - X","pub":"Super Scene","platform":"X","value":150000},{"key":"Superbaker - FB","pub":"Superbaker","platform":"Facebook","value":210000},{"key":"Superstarnews - FB","pub":"Superstarnews","platform":"Facebook","value":150000},{"key":"Superstarnews - X","pub":"Superstarnews","platform":"X","value":150000},{"key":"Superstarnews - YT","pub":"Superstarnews","platform":"YouTube","value":150000},{"key":"Taladbandee.com","pub":"Taladbandee.com","platform":"Web","value":150000},{"key":"Talk About Market - FB","pub":"Talk About Market","platform":"Facebook","value":150000},{"key":"Talk in Trend - FB","pub":"Talk in Trend","platform":"Facebook","value":150000},{"key":"Talk in Trend - IG","pub":"Talk in Trend","platform":"Instagram","value":150000},{"key":"Talk in Trend - X","pub":"Talk in Trend","platform":"X","value":150000},{"key":"Talkaboutmarket.com","pub":"Talkaboutmarket.com","platform":"Web","value":150000},{"key":"Talktoday - FB","pub":"Talktoday","platform":"Facebook","value":150000},{"key":"Talktoday  ทอล์กทูเดย์ - YT","pub":"Talktoday  ทอล์กทูเดย์","platform":"YouTube","value":210000},{"key":"Tamago Free Magazine - FB","pub":"Tamago Free Magazine","platform":"Facebook","value":150000},{"key":"Tamago Free Magazine - IG","pub":"Tamago Free Magazine","platform":"Instagram","value":150000},{"key":"Tamago Free Magazine - X","pub":"Tamago Free Magazine","platform":"X","value":150000},{"key":"Tamagofreemag - IG","pub":"Tamagofreemag","platform":"Instagram","value":150000},{"key":"Tamagofreemag.com","pub":"Tamagofreemag.com","platform":"Web","value":150000},{"key":"Tammaaom - Tiktok","pub":"Tammaaom","platform":"TikTok","value":150000},{"key":"Tanamon Cesari - FB","pub":"Tanamon Cesari","platform":"Facebook","value":210000},{"key":"Taste so talk - FB","pub":"Taste so talk","platform":"Facebook","value":150000},{"key":"Tastesotalk.com","pub":"Tastesotalk.com","platform":"Web","value":150000},{"key":"Tatbangkok - Tiktok","pub":"Tatbangkok","platform":"TikTok","value":150000},{"key":"Tawansiam News - FB","pub":"Tawansiam News","platform":"Facebook","value":150000},{"key":"TBT NEWS","pub":"TBT NEWS","platform":"Web","value":150000},{"key":"Techmoveon.com","pub":"Techmoveon.com","platform":"Web","value":150000},{"key":"Techsauce.co","pub":"Techsauce.co","platform":"Web","value":210000},{"key":"Teen club - FB","pub":"Teen club","platform":"Facebook","value":150000},{"key":"Teenclubth.com","pub":"Teenclubth.com","platform":"Web","value":150000},{"key":"TerraBkk - FB","pub":"TerraBkk","platform":"Facebook","value":210000},{"key":"Terrabkk.com","pub":"Terrabkk.com","platform":"Web","value":210000},{"key":"Th-hellomagazine.com","pub":"Th-hellomagazine.com","platform":"Web","value":360000},{"key":"Thai Food Business - FB","pub":"Thai Food Business","platform":"Facebook","value":150000},{"key":"Thai Pbs - FB","pub":"Thai Pbs","platform":"Facebook","value":360000},{"key":"Thai Pbs -ไทยบันเทิง  - FB","pub":"Thai Pbs -ไทยบันเทิง","platform":"Facebook","value":210000},{"key":"Thai Pbs -ไทยบันเทิง  - YT","pub":"Thai Pbs -ไทยบันเทิง","platform":"YouTube","value":210000},{"key":"Thai Suptar News - FB","pub":"Thai Suptar News","platform":"Facebook","value":150000},{"key":"Thaibunterng thaipbs - FB","pub":"Thaibunterng thaipbs","platform":"Facebook","value":360000},{"key":"Thaibunterng thaipbs - YT","pub":"Thaibunterng thaipbs","platform":"YouTube","value":360000},{"key":"Thaiedunews.net","pub":"Thaiedunews.net","platform":"Web","value":150000},{"key":"Thaifoodbusiness.com","pub":"Thaifoodbusiness.com","platform":"Web","value":150000},{"key":"Thailand Smart Content - FB","pub":"Thailand Smart Content","platform":"Facebook","value":150000},{"key":"Thailand Update - FB","pub":"Thailand Update","platform":"Facebook","value":210000},{"key":"Thailand.postsen.com","pub":"Thailand.postsen.com","platform":"Web","value":150000},{"key":"Thailand4.com","pub":"Thailand4.com","platform":"Web","value":150000},{"key":"Thailandexhibition - FB","pub":"Thailandexhibition","platform":"Facebook","value":210000},{"key":"Thailandexhibition - IG","pub":"Thailandexhibition","platform":"Instagram","value":210000},{"key":"Thailandexhibition.com","pub":"Thailandexhibition.com","platform":"Web","value":210000},{"key":"Thailandmovement.com","pub":"Thailandmovement.com","platform":"Web","value":150000},{"key":"Thailandreporter.com","pub":"Thailandreporter.com","platform":"Web","value":150000},{"key":"Thaimlmnews - FB","pub":"Thaimlmnews","platform":"Facebook","value":150000},{"key":"Thaimlmnews.com","pub":"Thaimlmnews.com","platform":"Web","value":150000},{"key":"Thaimungnews - FB","pub":"Thaimungnews","platform":"Facebook","value":150000},{"key":"Thaimungnews.com","pub":"Thaimungnews.com","platform":"Web","value":150000},{"key":"ThaiNews – ไทยนิวส์ - FB","pub":"ThaiNews – ไทยนิวส์","platform":"Facebook","value":360000},{"key":"Thainews.prd.go.th","pub":"Thainews.prd.go.th","platform":"Web","value":210000},{"key":"Thainewsbiz.com","pub":"Thainewsbiz.com","platform":"Web","value":150000},{"key":"Thaipackmagazine.com","pub":"Thaipackmagazine.com","platform":"Web","value":150000},{"key":"Thaipbs Thaibunterng - YT","pub":"Thaipbs Thaibunterng","platform":"YouTube","value":210000},{"key":"Thaipbs.or.th","pub":"Thaipbs.or.th","platform":"Web","value":360000},{"key":"Thaipost - FB","pub":"Thaipost","platform":"Facebook","value":210000},{"key":"Thaipost - LINE TODAY","pub":"Thaipost","platform":"LINE TODAY","value":210000},{"key":"Thaipost - X","pub":"Thaipost","platform":"X","value":210000},{"key":"Thaipost.net","pub":"Thaipost.net","platform":"Web","value":210000},{"key":"Thaipr.net","pub":"Thaipr.net","platform":"Web","value":150000},{"key":"Thaipropertymentor.com","pub":"Thaipropertymentor.com","platform":"Web","value":150000},{"key":"Thairath - FB","pub":"Thairath","platform":"Facebook","value":360000},{"key":"Thairath - IG","pub":"Thairath","platform":"Instagram","value":360000},{"key":"Thairath - LINE TODAY","pub":"Thairath","platform":"LINE TODAY","value":360000},{"key":"Thairath - TV","pub":"Thairath","platform":"TV","value":252000},{"key":"Thairath - X","pub":"Thairath","platform":"X","value":360000},{"key":"Thairath - YT","pub":"Thairath","platform":"YouTube","value":360000},{"key":"Thairath Plus - FB","pub":"Thairath Plus","platform":"Facebook","value":360000},{"key":"Thairath Plus - IG","pub":"Thairath Plus","platform":"Instagram","value":360000},{"key":"Thairath Plus - X","pub":"Thairath Plus","platform":"X","value":360000},{"key":"Thairath.co.th","pub":"Thairath.co.th","platform":"Web","value":360000},{"key":"Thairathtv - FB","pub":"Thairathtv","platform":"Facebook","value":360000},{"key":"Thairemark.com","pub":"Thairemark.com","platform":"Web","value":150000},{"key":"Thaitimenews - FB","pub":"Thaitimenews","platform":"Facebook","value":150000},{"key":"Thaitimenews.com","pub":"Thaitimenews.com","platform":"Web","value":150000},{"key":"Thansettakij - FB","pub":"Thansettakij","platform":"Facebook","value":210000},{"key":"Thansettakij - LINE TODAY","pub":"Thansettakij","platform":"LINE TODAY","value":210000},{"key":"Thansettakij - Msn","pub":"Thansettakij","platform":"MSN","value":210000},{"key":"Thansettakij.com","pub":"Thansettakij.com","platform":"Web","value":210000},{"key":"The Cloud - FB","pub":"The Cloud","platform":"Facebook","value":210000},{"key":"The Cloud - IG","pub":"The Cloud","platform":"Instagram","value":210000},{"key":"The Cloud - X","pub":"The Cloud","platform":"X","value":210000},{"key":"The Daily Bangkok - FB","pub":"The Daily Bangkok","platform":"Facebook","value":150000},{"key":"The Daily Bangkok - YT","pub":"The Daily Bangkok","platform":"YouTube","value":150000},{"key":"The Editors Society - FB","pub":"The Editors Society","platform":"Facebook","value":210000},{"key":"The Journey Moment - FB","pub":"The Journey Moment","platform":"Facebook","value":150000},{"key":"The MATTER - FB","pub":"The MATTER","platform":"Facebook","value":360000},{"key":"The MATTER - IG","pub":"The MATTER","platform":"Instagram","value":360000},{"key":"The MATTER - LINE TODAY","pub":"The MATTER","platform":"LINE TODAY","value":360000},{"key":"The MATTER - X","pub":"The MATTER","platform":"X","value":360000},{"key":"The Momentum - FB","pub":"The Momentum","platform":"Facebook","value":360000},{"key":"The Momentum - IG","pub":"The Momentum","platform":"Instagram","value":360000},{"key":"The Momentum - X","pub":"The Momentum","platform":"X","value":360000},{"key":"The Photo News - FB","pub":"The Photo News","platform":"Facebook","value":150000},{"key":"The Present Move  - FB","pub":"The Present Move","platform":"Facebook","value":150000},{"key":"The Present Move  - IG","pub":"The Present Move","platform":"Instagram","value":150000},{"key":"The rainbow news ent - X","pub":"The rainbow news ent","platform":"X","value":150000},{"key":"The Standard Pop - FB","pub":"The Standard Pop","platform":"Facebook","value":210000},{"key":"The Standard Pop - IG","pub":"The Standard Pop","platform":"Instagram","value":210000},{"key":"The Standard Pop - X","pub":"The Standard Pop","platform":"X","value":210000},{"key":"The Story Thailand - FB","pub":"The Story Thailand","platform":"Facebook","value":150000},{"key":"The Up-Close - FB","pub":"The Up-Close","platform":"Facebook","value":150000},{"key":"The Up-Close - X","pub":"The Up-Close","platform":"X","value":150000},{"key":"The Vis Lit  - FB","pub":"The Vis Lit","platform":"Facebook","value":150000},{"key":"The Vis Lit  - IG","pub":"The Vis Lit","platform":"Instagram","value":150000},{"key":"The Xpozir - FB","pub":"The Xpozir","platform":"Facebook","value":150000},{"key":"The-perspective.co","pub":"The-perspective.co","platform":"Web","value":150000},{"key":"Theartomotive.com","pub":"Theartomotive.com","platform":"Web","value":150000},{"key":"Thebangkoktimes.com","pub":"Thebangkoktimes.com","platform":"Web","value":150000},{"key":"Thebeat.asia","pub":"Thebeat.asia","platform":"Web","value":150000},{"key":"Thebetter  - FB","pub":"Thebetter","platform":"Facebook","value":210000},{"key":"Thebetter - IG","pub":"Thebetter","platform":"Instagram","value":210000},{"key":"Thebetter - LINE TODAY","pub":"Thebetter","platform":"LINE TODAY","value":210000},{"key":"Thebetter.co.th","pub":"Thebetter.co.th","platform":"Web","value":210000},{"key":"Thebusinessplus.com","pub":"Thebusinessplus.com","platform":"Web","value":210000},{"key":"Thedailybangkok.com","pub":"Thedailybangkok.com","platform":"Web","value":150000},{"key":"Thedailybkk - X","pub":"Thedailybkk","platform":"X","value":150000},{"key":"Theenterprise.cc","pub":"Theenterprise.cc","platform":"Web","value":150000},{"key":"Theexcellencebkk.com","pub":"Theexcellencebkk.com","platform":"Web","value":150000},{"key":"Thejourneymoments - Tiktok","pub":"Thejourneymoments","platform":"TikTok","value":150000},{"key":"Theleaderasia.com","pub":"Theleaderasia.com","platform":"Web","value":150000},{"key":"Themasterth.com","pub":"Themasterth.com","platform":"Web","value":150000},{"key":"Thematter.co","pub":"Thematter.co","platform":"Web","value":360000},{"key":"Themomentum.co","pub":"Themomentum.co","platform":"Web","value":360000},{"key":"Theoptimized.com","pub":"Theoptimized.com","platform":"Web","value":150000},{"key":"Thepeople - IG","pub":"Thepeople","platform":"Instagram","value":210000},{"key":"Thepeople.co","pub":"Thepeople.co","platform":"Web","value":210000},{"key":"Thereporter.asia","pub":"Thereporter.asia","platform":"Web","value":210000},{"key":"Thereporters.co","pub":"Thereporters.co","platform":"Web","value":360000},{"key":"Theroom44Channel - FB","pub":"Theroom44Channel","platform":"Facebook","value":210000},{"key":"Theroom44Channel - IG","pub":"Theroom44Channel","platform":"Instagram","value":210000},{"key":"Theroom44Channel - LINE TODAY","pub":"Theroom44Channel","platform":"LINE TODAY","value":210000},{"key":"Thesiamese.net","pub":"Thesiamese.net","platform":"Web","value":150000},{"key":"Thestandard - FB","pub":"Thestandard","platform":"Facebook","value":360000},{"key":"Thestandard - IG","pub":"Thestandard","platform":"Instagram","value":360000},{"key":"Thestandard.co","pub":"Thestandard.co","platform":"Web","value":360000},{"key":"Thestandard.com","pub":"Thestandard.com","platform":"Web","value":360000},{"key":"Thestandard.Life - FB","pub":"Thestandard.Life","platform":"Facebook","value":210000},{"key":"Thestandard.Life - IG","pub":"Thestandard.Life","platform":"Instagram","value":210000},{"key":"Thestandard.Life - Tiktok","pub":"Thestandard.Life","platform":"TikTok","value":210000},{"key":"Thestandard.Life - X","pub":"Thestandard.Life","platform":"X","value":210000},{"key":"Thestandard.Life - YT","pub":"Thestandard.Life","platform":"YouTube","value":360000},{"key":"Thestorythailand.com","pub":"Thestorythailand.com","platform":"Web","value":150000},{"key":"Thethaiger - FB","pub":"Thethaiger","platform":"Facebook","value":150000},{"key":"Thethaiger - IG","pub":"Thethaiger","platform":"Instagram","value":150000},{"key":"Thethaiger.com","pub":"Thethaiger.com","platform":"Web","value":150000},{"key":"Theusbmedia.com","pub":"Theusbmedia.com","platform":"Web","value":150000},{"key":"Thheadline - FB","pub":"Thheadline","platform":"Facebook","value":150000},{"key":"Thheadline - IG","pub":"Thheadline","platform":"Instagram","value":150000},{"key":"Thheadline - X","pub":"Thheadline","platform":"X","value":150000},{"key":"Thheadline.com","pub":"Thheadline.com","platform":"Web","value":150000},{"key":"Thinsiam.com","pub":"Thinsiam.com","platform":"Web","value":150000},{"key":"Thissalife.com","pub":"Thissalife.com","platform":"Web","value":150000},{"key":"Ticy City - FB","pub":"Ticy City","platform":"Facebook","value":150000},{"key":"Ticycity.com","pub":"Ticycity.com","platform":"Web","value":150000},{"key":"Tid.pro - IG","pub":"Tid.pro","platform":"Instagram","value":150000},{"key":"Tigernews.tv","pub":"Tigernews.tv","platform":"Web","value":150000},{"key":"Time Out - กรุงเทพฯ - FB","pub":"Time Out - กรุงเทพฯ","platform":"Facebook","value":360000},{"key":"Time Out - กรุงเทพฯ  - IG","pub":"Time Out - กรุงเทพฯ","platform":"Instagram","value":360000},{"key":"Time Out - กรุงเทพฯ  - Tiktok","pub":"Time Out - กรุงเทพฯ","platform":"TikTok","value":360000},{"key":"Time Out Bangkok - FB","pub":"Time Out Bangkok","platform":"Facebook","value":360000},{"key":"Time Out Bangkok - IG","pub":"Time Out Bangkok","platform":"Instagram","value":360000},{"key":"Timeout.com","pub":"Timeout.com","platform":"Web","value":360000},{"key":"Tingbt.Com","pub":"Tingbt.Com","platform":"Web","value":150000},{"key":"Tingthinkthing - X","pub":"Tingthinkthing","platform":"X","value":150000},{"key":"Tmg.Tammagin - Tiktok","pub":"Tmg.Tammagin","platform":"TikTok","value":150000},{"key":"TNews-ทีนิวส์ - FB","pub":"TNews-ทีนิวส์","platform":"Facebook","value":360000},{"key":"Tnn - FB","pub":"Tnn","platform":"Facebook","value":210000},{"key":"Tnn - LINE TODAY","pub":"Tnn","platform":"LINE TODAY","value":210000},{"key":"Tnn - Tiktok","pub":"Tnn","platform":"TikTok","value":210000},{"key":"Tnn - YT","pub":"Tnn","platform":"YouTube","value":210000},{"key":"TNN 16 - YT","pub":"TNN 16","platform":"YouTube","value":210000},{"key":"Tnn Live - FB","pub":"Tnn Live","platform":"Facebook","value":210000},{"key":"Tnn Wealth - FB","pub":"Tnn Wealth","platform":"Facebook","value":210000},{"key":"Tnn Wealth - Tiktok","pub":"Tnn Wealth","platform":"TikTok","value":210000},{"key":"Tnnthailand.com","pub":"Tnnthailand.com","platform":"Web","value":210000},{"key":"TODAY Bizview - FB","pub":"TODAY Bizview","platform":"Facebook","value":210000},{"key":"TODAY Bizview - LINE TODAY","pub":"TODAY Bizview","platform":"LINE TODAY","value":210000},{"key":"Today Entertain  - FB","pub":"Today Entertain","platform":"Facebook","value":150000},{"key":"Today Entertain - X","pub":"Today Entertain","platform":"X","value":150000},{"key":"Today Entertain - YT","pub":"Today Entertain","platform":"YouTube","value":150000},{"key":"Today Highlight News - FB","pub":"Today Highlight News","platform":"Facebook","value":150000},{"key":"Todayhighlightnews.com","pub":"Todayhighlightnews.com","platform":"Web","value":150000},{"key":"Todayupdatenews.com","pub":"Todayupdatenews.com","platform":"Web","value":150000},{"key":"Tongpaii - FB","pub":"Tongpaii","platform":"Facebook","value":210000},{"key":"Tongpaii - IG","pub":"Tongpaii","platform":"Instagram","value":210000},{"key":"Tongpaii - Tiktok","pub":"Tongpaii","platform":"TikTok","value":210000},{"key":"Tonthanasit - IG","pub":"Tonthanasit","platform":"Instagram","value":210000},{"key":"Top Dara - FB","pub":"Top Dara","platform":"Facebook","value":210000},{"key":"Top Dara - YT","pub":"Top Dara","platform":"YouTube","value":210000},{"key":"Top News  - FB","pub":"Top News","platform":"Facebook","value":210000},{"key":"Tornokandcourse - IG","pub":"Tornokandcourse","platform":"Instagram","value":150000},{"key":"Tornokandcourse - X","pub":"Tornokandcourse","platform":"X","value":210000},{"key":"Torpenguin - FB","pub":"Torpenguin","platform":"Facebook","value":210000},{"key":"Toyfully Art, Toy And Joyfully - FB","pub":"Toyfully Art, Toy And Joyfully","platform":"Facebook","value":150000},{"key":"Toyfully Art, Toy And Joyfully - IG","pub":"Toyfully Art, Toy And Joyfully","platform":"Instagram","value":150000},{"key":"Toyfully Art, Toy And Joyfully - Tiktok","pub":"Toyfully Art, Toy And Joyfully","platform":"TikTok","value":150000},{"key":"Toyfully Art, Toy And Joyfully - YT","pub":"Toyfully Art, Toy And Joyfully","platform":"YouTube","value":150000},{"key":"Travel Here - FB","pub":"Travel Here","platform":"Facebook","value":150000},{"key":"Travel Here - IG","pub":"Travel Here","platform":"Instagram","value":150000},{"key":"Travel.trueid.net","pub":"Travel.trueid.net","platform":"Web","value":360000},{"key":"Travelerspulse - FB","pub":"Travelerspulse","platform":"Facebook","value":150000},{"key":"Travelerspulse - IG","pub":"Travelerspulse","platform":"Instagram","value":150000},{"key":"Travelerspulse - Tiktok","pub":"Travelerspulse","platform":"TikTok","value":150000},{"key":"Travelicious : เที่ยวติดอร่อย","pub":"Travelicious : เที่ยวติดอร่อย","platform":"Web","value":150000},{"key":"Trendy__Thailand - IG","pub":"Trendy__Thailand","platform":"Instagram","value":150000},{"key":"Tripleclic - FB","pub":"Tripleclic","platform":"Facebook","value":150000},{"key":"Tripleclic - X","pub":"Tripleclic","platform":"X","value":150000},{"key":"Tripleclick - X","pub":"Tripleclick","platform":"X","value":150000},{"key":"Tripleclick Th - FB","pub":"Tripleclick Th","platform":"Facebook","value":150000},{"key":"Tripleclick Th - X","pub":"Tripleclick Th","platform":"X","value":150000},{"key":"Tripleclick Th - YT","pub":"Tripleclick Th","platform":"YouTube","value":150000},{"key":"Trjournalnews.com","pub":"Trjournalnews.com","platform":"Web","value":150000},{"key":"TrueID Lifestyle - FB","pub":"TrueID Lifestyle","platform":"Facebook","value":360000},{"key":"Tswar - IG","pub":"Tswar","platform":"Instagram","value":210000},{"key":"Turakijintrend.com","pub":"Turakijintrend.com","platform":"Web","value":150000},{"key":"TVPool - FB","pub":"TVPool","platform":"Facebook","value":360000},{"key":"TVPool - X","pub":"TVPool","platform":"X","value":210000},{"key":"TVPool - YT","pub":"TVPool","platform":"YouTube","value":360000},{"key":"Tvpoolonline.com","pub":"Tvpoolonline.com","platform":"Web","value":210000},{"key":"Twave by Korean Updates - FB","pub":"Twave by Korean Updates","platform":"Facebook","value":150000},{"key":"Twave by Korean Updates - X","pub":"Twave by Korean Updates","platform":"X","value":150000},{"key":"Twentyfour News - FB","pub":"Twentyfour News","platform":"Facebook","value":150000},{"key":"Twentyfour News - X","pub":"Twentyfour News","platform":"X","value":150000},{"key":"Twentyfour News - YT","pub":"Twentyfour News","platform":"YouTube","value":150000},{"key":"Twentyfour-news.com","pub":"Twentyfour-news.com","platform":"Web","value":150000},{"key":"Update Today - X","pub":"Update Today","platform":"X","value":150000},{"key":"Update Today - YT","pub":"Update Today","platform":"YouTube","value":150000},{"key":"Urban Creature - FB","pub":"Urban Creature","platform":"Facebook","value":210000},{"key":"Urban Creature - IG","pub":"Urban Creature","platform":"Instagram","value":210000},{"key":"Urban Creature - X","pub":"Urban Creature","platform":"X","value":210000},{"key":"Urbancreature.co","pub":"Urbancreature.co","platform":"Web","value":210000},{"key":"Vacationistmag.com","pub":"Vacationistmag.com","platform":"Web","value":150000},{"key":"Vateekhao.com","pub":"Vateekhao.com","platform":"Web","value":150000},{"key":"Visit บางกอก - FB","pub":"Visit บางกอก","platform":"Facebook","value":150000},{"key":"Visitbangkok.Thailand - FB","pub":"Visitbangkok.Thailand","platform":"Facebook","value":150000},{"key":"Vnexplorer.net","pub":"Vnexplorer.net","platform":"Web","value":150000},{"key":"Vnnthailand.com","pub":"Vnnthailand.com","platform":"Web","value":150000},{"key":"Vogue - FB","pub":"Vogue","platform":"Facebook","value":360000},{"key":"Vogue - IG","pub":"Vogue","platform":"Instagram","value":360000},{"key":"Vogue - X","pub":"Vogue","platform":"X","value":360000},{"key":"Vogue.co.th","pub":"Vogue.co.th","platform":"Web","value":360000},{"key":"Voguebeauty - IG","pub":"Voguebeauty","platform":"Instagram","value":360000},{"key":"Voguebeautyth - FB","pub":"Voguebeautyth","platform":"Facebook","value":360000},{"key":"Voguebeautyth - IG","pub":"Voguebeautyth","platform":"Instagram","value":360000},{"key":"Voguethailand - IG","pub":"Voguethailand","platform":"Instagram","value":360000},{"key":"Wannateller.com","pub":"Wannateller.com","platform":"Web","value":150000},{"key":"Warngpaidi - IG","pub":"Warngpaidi","platform":"Instagram","value":150000},{"key":"Warngpaidi - Tiktok","pub":"Warngpaidi","platform":"TikTok","value":150000},{"key":"Wealthnbiz.com","pub":"Wealthnbiz.com","platform":"Web","value":150000},{"key":"Weed Ent - FB","pub":"Weed Ent","platform":"Facebook","value":150000},{"key":"Weed Ent - X","pub":"Weed Ent","platform":"X","value":150000},{"key":"Weed Ent - YT","pub":"Weed Ent","platform":"YouTube","value":150000},{"key":"Weekend Magazine - FB","pub":"Weekend Magazine","platform":"Facebook","value":360000},{"key":"Weekend Magazine - IG","pub":"Weekend Magazine","platform":"Instagram","value":360000},{"key":"Weintrend - FB","pub":"Weintrend","platform":"Facebook","value":150000},{"key":"Weintrend - X","pub":"Weintrend","platform":"X","value":150000},{"key":"Weintrendtv","pub":"Weintrendtv","platform":"Web","value":150000},{"key":"Weintrendtv - X","pub":"Weintrendtv","platform":"X","value":150000},{"key":"Wom Ent - FB","pub":"Wom Ent","platform":"Facebook","value":150000},{"key":"Wom Entertainment News - FB","pub":"Wom Entertainment News","platform":"Facebook","value":150000},{"key":"Wom Entertainment News - X","pub":"Wom Entertainment News","platform":"X","value":150000},{"key":"Wongnai - FB","pub":"Wongnai","platform":"Facebook","value":360000},{"key":"Wongnai Beauty - FB","pub":"Wongnai Beauty","platform":"Facebook","value":360000},{"key":"Wongnai Travel - FB","pub":"Wongnai Travel","platform":"Facebook","value":360000},{"key":"Wongnai Vibes - FB","pub":"Wongnai Vibes","platform":"Facebook","value":210000},{"key":"Wongnai Vibes - IG","pub":"Wongnai Vibes","platform":"Instagram","value":210000},{"key":"Woofpackbangkok - FB","pub":"Woofpackbangkok","platform":"Facebook","value":150000},{"key":"Woofpackbangkok - IG","pub":"Woofpackbangkok","platform":"Instagram","value":150000},{"key":"Woopmag - FB","pub":"Woopmag","platform":"Facebook","value":150000},{"key":"Woopmag - X","pub":"Woopmag","platform":"X","value":150000},{"key":"Woopmag - YT","pub":"Woopmag","platform":"YouTube","value":150000},{"key":"Woopmag.com","pub":"Woopmag.com","platform":"Web","value":150000},{"key":"Workpointnews.com","pub":"Workpointnews.com","platform":"Web","value":360000},{"key":"Workpointtoday - FB","pub":"Workpointtoday","platform":"Facebook","value":360000},{"key":"Workpointtoday - LINE TODAY","pub":"Workpointtoday","platform":"LINE TODAY","value":360000},{"key":"Workpointtoday.com","pub":"Workpointtoday.com","platform":"Web","value":360000},{"key":"Worldbusiness-th.com","pub":"Worldbusiness-th.com","platform":"Web","value":150000},{"key":"Xpozir.com","pub":"Xpozir.com","platform":"Web","value":150000},{"key":"Y-life.co - FB","pub":"Y-life.co","platform":"Facebook","value":150000},{"key":"Y-life.co","pub":"Y-life.co","platform":"Web","value":150000},{"key":"Yaklongtun.com","pub":"Yaklongtun.com","platform":"Web","value":150000},{"key":"Ygig.Official - IG","pub":"Ygig.Official","platform":"Instagram","value":150000},{"key":"Yloveyouchannel - X","pub":"Yloveyouchannel","platform":"X","value":150000},{"key":"Yloveyouchannel - YT","pub":"Yloveyouchannel","platform":"YouTube","value":150000},{"key":"Yuiolivia - IG","pub":"Yuiolivia","platform":"Instagram","value":210000},{"key":"Zcart  - FB","pub":"Zcart","platform":"Facebook","value":150000},{"key":"Zcart  - IG","pub":"Zcart","platform":"Instagram","value":150000},{"key":"Zcart  - Lemon8","pub":"Zcart","platform":"Lemon8","value":150000},{"key":"Zcart  - Tiktok","pub":"Zcart","platform":"TikTok","value":150000},{"key":"Zcart  - YT","pub":"Zcart","platform":"YouTube","value":150000},{"key":"Zipevent - FB","pub":"Zipevent","platform":"Facebook","value":210000},{"key":"Zipevent - IG","pub":"Zipevent","platform":"Instagram","value":210000},{"key":"Zipevent - LINE TODAY","pub":"Zipevent","platform":"LINE TODAY","value":210000},{"key":"Zipevent - X","pub":"Zipevent","platform":"X","value":210000},{"key":"Zipeventapp - FB","pub":"Zipeventapp","platform":"Facebook","value":210000},{"key":"Zipeventapp - IG","pub":"Zipeventapp","platform":"Instagram","value":210000},{"key":"Zipeventapp - LINE TODAY","pub":"Zipeventapp","platform":"LINE TODAY","value":210000},{"key":"Zipeventapp.com","pub":"Zipeventapp.com","platform":"Web","value":210000},{"key":"Zokzakdara - FB","pub":"Zokzakdara","platform":"Facebook","value":150000},{"key":"Zokzakdara - X","pub":"Zokzakdara","platform":"X","value":150000},{"key":"Zokzakdara Special - X","pub":"Zokzakdara Special","platform":"X","value":150000},{"key":"Zoombusinessnews - FB","pub":"Zoombusinessnews","platform":"Facebook","value":150000},{"key":"Zoombusinessnews.com","pub":"Zoombusinessnews.com","platform":"Web","value":150000},{"key":"Zoomdara - FB","pub":"Zoomdara","platform":"Facebook","value":150000},{"key":"Zoomdara - X","pub":"Zoomdara","platform":"X","value":150000},{"key":"Zoominstyle.com","pub":"Zoominstyle.com","platform":"Web","value":150000},{"key":"กรุงเทพน่าอยู่เนอะ - FB","pub":"กรุงเทพน่าอยู่เนอะ","platform":"Facebook","value":150000},{"key":"กรุงเทพมหานคร - FB","pub":"กรุงเทพมหานคร","platform":"Facebook","value":210000},{"key":"กรุงเทพมหานคร - IG","pub":"กรุงเทพมหานคร","platform":"Instagram","value":210000},{"key":"การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย - FB","pub":"การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย","platform":"Facebook","value":210000},{"key":"กินข้าวกับบูม - FB","pub":"กินข้าวกับบูม","platform":"Facebook","value":210000},{"key":"กินข้าวกับบูม - YT","pub":"กินข้าวกับบูม","platform":"YouTube","value":210000},{"key":"ข่าวสามสี - FB","pub":"ข่าวสามสี","platform":"Facebook","value":360000},{"key":"ข่าวสารท่องเที่ยว ททท. - FB","pub":"ข่าวสารท่องเที่ยว ททท.","platform":"Facebook","value":210000},{"key":"ข่าวเด่นประเด็นร้อนNews - FB","pub":"ข่าวเด่นประเด็นร้อนNews","platform":"Facebook","value":150000},{"key":"ข่าวเด่นประเด็นร้อนNews.com","pub":"ข่าวเด่นประเด็นร้อนNews.com","platform":"Web","value":150000},{"key":"ข่าวเวิร์คพอยท์ 23 - YT","pub":"ข่าวเวิร์คพอยท์ 23","platform":"YouTube","value":360000},{"key":"คลิปบันเทิง - FB","pub":"คลิปบันเทิง","platform":"Facebook","value":150000},{"key":"ความรู้รอบครัว @Capitalread - Tiktok","pub":"ความรู้รอบครัว @Capitalread","platform":"TikTok","value":150000},{"key":"จิกกะบาล portal recall - FB","pub":"จิกกะบาล portal recall","platform":"Facebook","value":150000},{"key":"จุดประกาย กรุงเทพธุรกิจ - FB","pub":"จุดประกาย กรุงเทพธุรกิจ","platform":"Facebook","value":210000},{"key":"ชอบโปร - Shobpro - FB","pub":"ชอบโปร - Shobpro","platform":"Facebook","value":360000},{"key":"ชอบโปร - Shobpro - IG","pub":"ชอบโปร - Shobpro","platform":"Instagram","value":360000},{"key":"ชอบโปร - Shobpro - Tiktok","pub":"ชอบโปร - Shobpro","platform":"TikTok","value":360000},{"key":"ชีพจรลงพุง - FB","pub":"ชีพจรลงพุง","platform":"Facebook","value":210000},{"key":"ชีวิตติดห้าง MallBangkok.com","pub":"ชีวิตติดห้าง MallBangkok.com","platform":"Web","value":150000},{"key":"ซอกแซกดารา - FB","pub":"ซอกแซกดารา","platform":"Facebook","value":150000},{"key":"ดม - SniffAround - FB","pub":"ดม - SniffAround","platform":"Facebook","value":210000},{"key":"ดม - SniffAround - IG","pub":"ดม - SniffAround","platform":"Instagram","value":210000},{"key":"ดูกันยัง - FB","pub":"ดูกันยัง","platform":"Facebook","value":150000},{"key":"ดูกันยัง - IG","pub":"ดูกันยัง","platform":"Instagram","value":150000},{"key":"ตัวตึง - FB","pub":"ตัวตึง","platform":"Facebook","value":210000},{"key":"ตัวตึง - IG","pub":"ตัวตึง","platform":"Instagram","value":210000},{"key":"ติดช้อป promotion - FB","pub":"ติดช้อป promotion","platform":"Facebook","value":360000},{"key":"ติดโปร - PRO addict - FB","pub":"ติดโปร - PRO addict","platform":"Facebook","value":360000},{"key":"ถึงเวลาเที่ยว Time To Travel - FB","pub":"ถึงเวลาเที่ยว Time To Travel","platform":"Facebook","value":210000},{"key":"ททท.สำนักงานกรุงเทพมหานคร : Tat Bangkok Office - FB","pub":"ททท.สำนักงานกรุงเทพมหานคร : Tat Bangkok Office","platform":"Facebook","value":150000},{"key":"ทริปตามใจ - FB","pub":"ทริปตามใจ","platform":"Facebook","value":150000},{"key":"ทริปตามใจ - IG","pub":"ทริปตามใจ","platform":"Instagram","value":150000},{"key":"ทริปตามใจ - Tiktok","pub":"ทริปตามใจ","platform":"TikTok","value":150000},{"key":"ที่ซุกหัวนอน - FB","pub":"ที่ซุกหัวนอน","platform":"Facebook","value":150000},{"key":"บันทึกนักหนีเที่ยว - FB","pub":"บันทึกนักหนีเที่ยว","platform":"Facebook","value":210000},{"key":"บันเทิง Society - FB","pub":"บันเทิง Society","platform":"Facebook","value":150000},{"key":"บันเทิง Society - IG","pub":"บันเทิง Society","platform":"Instagram","value":150000},{"key":"บันเทิง Society - X","pub":"บันเทิง Society","platform":"X","value":150000},{"key":"บุรินทร์เจอนี่ - FB","pub":"บุรินทร์เจอนี่","platform":"Facebook","value":150000},{"key":"ปันโปร - Punpromotion - FB","pub":"ปันโปร - Punpromotion","platform":"Facebook","value":360000},{"key":"ปันโปร - Punpromotion - IG","pub":"ปันโปร - Punpromotion","platform":"Instagram","value":360000},{"key":"ปันโปร - Punpromotion - Tiktok","pub":"ปันโปร - Punpromotion","platform":"TikTok","value":360000},{"key":"พักก่อน - FB","pub":"พักก่อน","platform":"Facebook","value":150000},{"key":"พักก่อน - IG","pub":"พักก่อน","platform":"Instagram","value":150000},{"key":"พักก่อน - Tiktok","pub":"พักก่อน","platform":"TikTok","value":150000},{"key":"พาไปกิน - FB","pub":"พาไปกิน","platform":"Facebook","value":210000},{"key":"พาไปกิน - IG","pub":"พาไปกิน","platform":"Instagram","value":210000},{"key":"มนุษย์ต่างวัย - FB","pub":"มนุษย์ต่างวัย","platform":"Facebook","value":210000},{"key":"มนุษย์ต่างวัย - IG","pub":"มนุษย์ต่างวัย","platform":"Instagram","value":210000},{"key":"มนุษย์ต่างวัย - Tiktok","pub":"มนุษย์ต่างวัย","platform":"TikTok","value":210000},{"key":"ม่อนเอง - FB","pub":"ม่อนเอง","platform":"Facebook","value":210000},{"key":"รอบรั้วอ่อนนุช พัฒนาการ พระโขนง ศรีนครินทร์ - FB","pub":"รอบรั้วอ่อนนุช พัฒนาการ พระโขนง ศรีนครินทร์","platform":"Facebook","value":150000},{"key":"รีวิว Review Here - FB","pub":"รีวิว Review Here","platform":"Facebook","value":360000},{"key":"รีวิว ชอบโปร - FB","pub":"รีวิว ชอบโปร","platform":"Facebook","value":360000},{"key":"วันนี้กินไรดีวะ - FB","pub":"วันนี้กินไรดีวะ","platform":"Facebook","value":360000},{"key":"วันนี้ลา - FB","pub":"วันนี้ลา","platform":"Facebook","value":210000},{"key":"วันนี้ลา - Tiktok","pub":"วันนี้ลา","platform":"TikTok","value":210000},{"key":"วายเลิฟยู - Tiktok","pub":"วายเลิฟยู","platform":"TikTok","value":150000},{"key":"วายเลิฟยู - X","pub":"วายเลิฟยู","platform":"X","value":150000},{"key":"วายเลิฟยู - YT","pub":"วายเลิฟยู","platform":"YouTube","value":150000},{"key":"สารพันข่าว - FB","pub":"สารพันข่าว","platform":"Facebook","value":150000},{"key":"สำนักงานเขตพระนคร - FB","pub":"สำนักงานเขตพระนคร","platform":"Facebook","value":150000},{"key":"สำนักวัฒนธรรม กีฬา และการท่องเที่ยว - FB","pub":"สำนักวัฒนธรรม กีฬา และการท่องเที่ยว","platform":"Facebook","value":150000},{"key":"สื่อธุรกิจออนไลน์.com","pub":"สื่อธุรกิจออนไลน์.com","platform":"Web","value":150000},{"key":"หวังสร้างเมือง - FB","pub":"หวังสร้างเมือง","platform":"Facebook","value":150000},{"key":"ห้องข่าวบันเทิง - FB","pub":"ห้องข่าวบันเทิง","platform":"Facebook","value":360000},{"key":"อ อ ฟ ฟิ ศ เ ชี่ ย ว - FB","pub":"อ อ ฟ ฟิ ศ เ ชี่ ย ว","platform":"Facebook","value":210000},{"key":"อวยไส้แตกแหกไส้ฉีก - FB","pub":"อวยไส้แตกแหกไส้ฉีก","platform":"Facebook","value":360000},{"key":"อสังหา•กิน•เที่ยว•โรงแรม - FB","pub":"อสังหา•กิน•เที่ยว•โรงแรม","platform":"Facebook","value":150000},{"key":"อัปเดตนิทรรศการศิลปะ / eventต่าง ๆ - FB","pub":"อัปเดตนิทรรศการศิลปะ / eventต่าง ๆ","platform":"Facebook","value":210000},{"key":"อัปเดตนิทรรศการศิลปะและอีเวนต์ | โดย วาฬมีปีก - FB","pub":"อัปเดตนิทรรศการศิลปะและอีเวนต์ | โดย วาฬมีปีก","platform":"Facebook","value":210000},{"key":"อาหารข้างทาง กินไปเรื่อย - FB","pub":"อาหารข้างทาง กินไปเรื่อย","platform":"Facebook","value":210000},{"key":"เกาะกระแสเศรษฐกิจ - FB","pub":"เกาะกระแสเศรษฐกิจ","platform":"Facebook","value":150000},{"key":"เชื่อกู กูแดกมาแล้ว - FB","pub":"เชื่อกู กูแดกมาแล้ว","platform":"Facebook","value":360000},{"key":"เดือนนี้ติ่งไหน - FB","pub":"เดือนนี้ติ่งไหน","platform":"Facebook","value":150000},{"key":"เดือนนี้ติ่งไหน - X","pub":"เดือนนี้ติ่งไหน","platform":"X","value":150000},{"key":"เป็ดพาไป - FB","pub":"เป็ดพาไป","platform":"Facebook","value":210000},{"key":"เรื่องเล่าเช้านี้ - FB","pub":"เรื่องเล่าเช้านี้","platform":"Facebook","value":360000},{"key":"เรื่องเล่าเช้านี้ - YT","pub":"เรื่องเล่าเช้านี้","platform":"YouTube","value":360000},{"key":"เห็นแก่กิน - FB","pub":"เห็นแก่กิน","platform":"Facebook","value":210000},{"key":"เอกเอนเตอร์เทนเม้นท์ - FB","pub":"เอกเอนเตอร์เทนเม้นท์","platform":"Facebook","value":150000},{"key":"โซนข่าว Psi - FB","pub":"โซนข่าว Psi","platform":"Facebook","value":150000},{"key":"โซนข่าว Psi - X","pub":"โซนข่าว Psi","platform":"X","value":150000},{"key":"โซนข่าว Psi - YT","pub":"โซนข่าว Psi","platform":"YouTube","value":150000},{"key":"โซนข่าวพีเอสไอ - FB","pub":"โซนข่าวพีเอสไอ","platform":"Facebook","value":150000},{"key":"โตแล้วจะไปไหนก็ได้ - FB","pub":"โตแล้วจะไปไหนก็ได้","platform":"Facebook","value":150000},{"key":"โตแล้วไปไหนก็ได้ - FB","pub":"โตแล้วไปไหนก็ได้","platform":"Facebook","value":210000},{"key":"โตแล้วไปไหนก็ได้ - IG","pub":"โตแล้วไปไหนก็ได้","platform":"Instagram","value":210000},{"key":"โอปป้าซารางเฮ - FB","pub":"โอปป้าซารางเฮ","platform":"Facebook","value":150000},{"key":"ไทยบันเทิง thai pbs - FB","pub":"ไทยบันเทิง thai pbs","platform":"Facebook","value":210000},{"key":"ไทยบันเทิง thai pbs - YT","pub":"ไทยบันเทิง thai pbs","platform":"YouTube","value":210000},{"key":"ไทยไทย : thaithai - FB","pub":"ไทยไทย : thaithai","platform":"Facebook","value":210000},{"key":"ไปพิพิธภัณฑ์​แล้วหัวใจเบิกบาน  - FB","pub":"ไปพิพิธภัณฑ์​แล้วหัวใจเบิกบาน","platform":"Facebook","value":150000},{"key":"ไฟเขียว Greenlight-Ent. - FB","pub":"ไฟเขียว Greenlight-Ent.","platform":"Facebook","value":150000},{"key":"ไฟเขียว Greenlight-Ent. - Tiktok","pub":"ไฟเขียว Greenlight-Ent.","platform":"TikTok","value":150000},{"key":"ไฟเขียว Greenlight-Ent. - X","pub":"ไฟเขียว Greenlight-Ent.","platform":"X","value":150000}];
const LOGO_FILES=["Amarin TV.jpg","Khaosod Mall.jpg","Matichonweekly.jpg","One31 วันช่วยได้.jpg","One31.jpg","TV5.jpg","Amarin TV 34 ทุบโต๊ะข่าว.jpg","Ejan.jpg","Innnews.jpg","Nationtv .jpg","News1.jpg","Dailynews.1.jpg","The Room 44.jpg","ThaiPBS.jpg","Springnews.jpg","TAN MCOT.jpg","Amarin News.jpg","MGR Online Politics.jpg","Sirote Klampaiboon - FB.jpg","TERO Digital.jpg","Thairath Sport.jpg","Prachachat.jpg","Spring News Update.jpg","The Politics ข่าวบ้าน การเมือง.jpg","CH7HD News.jpg","Sanook.jpg","Ringside การเมือง.jpg","QFM.jpg","Nation Weekend.jpg","pptv.jpg","Voicetv.jpg","Themodernist.jpg","One31 New.jpg","EAZY MorningNews.jpg","THE STATES TIMES.jpg","BrandThink.jpg","Siamnews.jpg","โหดจัง จังหวัดภูเก็ต.jpg","ดูข่าวออนไลน์ - FB.jpg","iLaw.jpg","Siamrath.jpg","Voice TV - Wake Up Thailand - FB.jpg","Banmuang.jpg","Bizmatchingnews.com.jpg","Bangkok-today.com.jpg","Biztosuccess.com.jpg","Bluechipthai.com.jpg","Acnews.net.jpg","Smartlife-news.com.jpg","Theleaderasia.com.jpg","Wannateller.com.jpg","Newslive-thailand.com.jpg","Sudsapda.com.jpg","Thaipost.jpg","Khaoja.jpg","Efinancethai.com.jpg","Cbntchannel.com.jpg","The Reporters.jpg","Bkk head news - FB.jpg","Intrend news.jpg","Ggreenlifeplusmag.jpg","Theoptimized.com.jpg","Siamevent.com.jpg","Beartai.com.jpg","Columnai.jpg","Kaoupdate.com.jpg","Lady Society - FB.jpg","Lokwannee.com.jpg","Maganetthailand - FB.jpg","Newsdatatoday.com.jpg","Onedeedee.com.jpg","Positioningmag.com.jpg","Powertimetoday.com.jpg","Splendor-biz.com.jpg","Thailand Smart Content - FB.jpg","Thaimlmnews - FB.jpg","Thaimungnews.jpg","Thaitimenews - FB.jpg","turakijintrend.jpg","Trjournalnews.com.jpg","Changeintomag.com.jpg","manager.jpg","Mitikhao.com.jpg","Thainewsbiz.com.jpg","Onlinenewstime.com.jpg","Mixmagazine.in.th.jpg","Smmagonline.com.jpg","Thaipackmagazine.com.jpg","Allmiles.net.jpg","The Xpozir - FB.jpg","Thebusinessplus.com.jpg","wealthnbiz.jpg","Brandage.com.jpg","Sineha Bangkok - FB.jpg","Thejourneymoments.jpg","Praew.com.jpg","Hellomagazine.jpg","Thailand.postsen.com.jpg","Dailynews.2.jpg","thereporters.jpg","Artsequator.com.jpg","Inzpy.com.jpg","THE STANDARD.jpg","LUXUO Thailand - FB.jpg","sudsapda.jpg","Prestigeonline.jpg","FEED.jpg","MonoNews.jpg","Mono Entertain.jpg","PRESTIGE.jpg","Gavroche-thailande.com.jpg","Capitalread.co.jpg","TrueVisions.jpg","Matichon.jpg","Sepsakon.com.jpg","Fiercebook.jpg","Thepeople.co.jpg","Komchadluek.jpg","headtopics.jpg","Khaosod.jpg","Bangkok Today.jpg","Krungthep Turakij .jpg","AROUND Magazine.jpg","Naewna.jpg","FM 95.5 MHz.jpg","Expatsinbangkok.com.jpg","BK.jpg","Thairath.jpg","Thai Rath.jpg","mangozero.jpg","TrueID Lifestyle - FB.jpg","Spice.jpg","aday.jpg","Vacationistmag.com.jpg","Thestandard.jpg","HELLO.jpg","ELLE.jpg","Celebthailand.jpg","Gorgeousbkk.com.jpg","inzpy.jpg","INZPY SEEN - FB.jpg","Corehoononline.jpg","Innews.com.jpg","Mgronline.jpg","Celebonline.in.th.jpg","Pepperthailand.jpg","Marketthink.jpg","gourmetandcuisine.jpg","Thailandexhibition.jpg","Happeningbkk.jpg","Ticy City - FB.jpg","Ticycity.com.jpg","NationPhoto.jpg","GO With Her.jpg","Monderlust.jpg","GM Live.jpg","DNext - Dailynews Next.jpg","PPTV บันเทิง.jpg","Paikubpro.com.jpg","Sale Here.jpg","ถึงเวลาเที่ยว Time To Travel.jpg","TrueID.jpg","ทริปตามใจ.jpg","1197สายด่วนจราจร - FB.jpg","สำนักวัฒนธรรม.jpg","กรุงเทพมหานคร.jpg","Musicandartmag.com.jpg","Lemon8-app.com.jpg","Routeen.jpg","Bkkmenu.jpg","Eventpassapp.jpg","Sineha Bangkok.jpg","Guru by Bangkok Post.jpg","THE STANDARD LIFE.jpg","Happening mag.jpg","Sootinclaimon.jpg","Zoominstyle.jpg","Fotoinfo - กล้อง ถ่ายภาพ ท่องเที่ยว - FB.jpg","Sarakadee Lite.jpg","TNN World.jpg","zaabza.jpg","TNN16.jpg","Cheeze Pop-Up Market.jpg","Toyfully Art, Toy and Joyfully.jpg","Spacebar VIBE - FB.jpg","Wongnai Vibes - FB.jpg","3PlusNews.jpg","TheMomentum.jpg","Amarintv.jpg","CH7.jpg","CH3.jpg","จดอ.jpg","hisoparty.jpg","workpointtoday.jpg","mrbadboygo.jpg","Vnexplorer.jpg","Zipeventapp.jpg","TVPool.jpg","Daradaily.jpg","Newsplus.jpg","Apop.jpg","เรื่องเล่าเช้านี้.jpg","ข่าวเวิร์คพอยท์ 23.jpg","ห้องข่าวบันเทิง.jpg","Thebetter.jpg","Creativeecon.jpg","thissalife.jpg","Posttoday.jpg","Ibusiness.co.jpg","Sondhitalk.jpg","newszociety.jpg","theexcellencebkk.jpg","innewsthailand.jpg","vnnthailand.jpg","Thestandard.life.jpg","Adaddict.jpg","ดม - SniffAround.jpg","วันนี้ลา.jpg","OOPS.jpg","Lipsmagazine.jpg","Brickinfotv.jpg","พาไปกิน.jpg","Businessownertv.jpg","Successchannel.jpg","Amarin Baby & Kids.jpg","Marketeeronline.jpg","foodanyway.jpg","Eatindeed.jpg","Fineart Magazine Thailand.jpg","Sinehabangkok.jpg","Lifestyleasia.jpg","Theusbmedia.jpg","Artventure.jpg","The Photo News.jpg","Twentyfour-news.com.jpg","Dooddot.jpg","Mekhanews.jpg","Soul4Street.jpg","Kitchen&Home Magazine.jpg","Onceinlife.Co.jpg","thethaiger.jpg","ZCart.jpg","Happeningandfriends.jpg","Iameverything.Co.jpg","Time Out.jpg","Room Books.jpg","voguethailand.jpg","กินข้าวกับบูม.jpg","jiranarong2.jpg","Marketingoops.jpg","Ellementhailand.jpg","Warngpaidi.jpeg","Punpromotion.jpg","Prohubpromotion.jpg","Bangkok Wealth.jpg","Pooyingnaka..jpg","Bugaboo.jpg","Insomnia.jpg","Ryuisnow.jpg","Gdpbusiness.jpg","vateekhao.jpg","พักก่อน.jpg","Cheezelooker.jpg","Brandbuffet.jpg","readthecloud.jpg","Glineye.jpg","ม่อนเอง.jpg","TBT NEWS.jpg","Slimmingthai.jpg","eventbanana.jpg","Singha.jpg","Thairath Plus.jpg","Thairemark.jpg","362degree.jpg","Ebiznewstoday.jpg","สื่อธุรกิจออนไลน์.com.jpg","Ibiznewsmedia.com.jpg","Stageonleader.com.jpg","Thaimlmnews.com.jpg","thebangkoktimes.jpg","leadertoday.jpg","Arsa-story.com.jpg","Mbamagazine.jpg","thansettakij.jpg","Brandbiznews.jpg","perspective.jpg","Cioworldbusiness.com.jpg","Forbesthailand.jpg","joinalifethailand.jpg","Lifebiznews.com.jpg","Techmoveon.jpg","Moneylifenews.jpg","Mitihoon.jpg","Yaklongtun.jpg","Voguebeauty.jpg","Jeban.jpg","Ladykara.jpg","Ody.jpg","Monstermag.jpg","Marketplus.jpg","Korkasaesettakij.jpg","Bangkokpost.jpg","Indyreport.jpg","Biztalknews.jpg","Superstarnews.jpg","Allnewsth.jpg","Wom Entertainment News.jpg","Yloveyouchannel.jpg","Twentyfournews.jpg","Topnew.jpg","Topdara.jpg","Emouth Gossip.jpg","Check In Entertainment.jpg","Weed_Ent.jpg","Cioworldnews.jpg","Madamemount.jpg","Jiggaban.jpg","Star Society.jpg","Tvpoolonline.jpg","Bunterngthaionline.jpg","Art4D.jpg","บุรินทร์เจอนี่.jpg","ThairathTV.jpg","All Area Entertainment.jpg","maya.jpg","Gossipstar.jpg","Spacebar.jpg","Lifetimemags.jpg","icnewsthailand.jpg","Makemoneyinsight.jpg","Zoombusinessnews.jpg","nationtv.jpg","Art of.jpg","Dokbia.jpg","Talktoday.jpg","fotoinfo.jpg","contestwar.jpg","fridaybkk.jpg","fyi.jpg","Artswork.jpg","Cheeze.jpg","Cloud.jpg","Bangkokartcity.jpg","Woofpackbangkok.jpg","Find Me Events.jpg","Friday Bangkok.jpg","Soimilk.jpg","Eventpop.jpg","Blt.jpg","BKKNOW.jpg","Art Tank Media.jpg","Dek-d.jpg","One Next Class.jpg","Lookermag.jpg","Urbancreature.jpg","Spicydisc.jpg","proxumer.jpg","Brighttv.jpg","Tamago Free Magazine - FB.jpg","Eventpass.jpg","Theroom44channel.com.jpg","Nylonthailand.jpg","inourhood.th.jpg","ชอบโปร - ShobPro.jpg","thaiticketmajor.jpg","Tongpaii.jpg","Mutual.jpg","Places Two Go.jpg","Living Sneak Peek.jpg","Couple Travel.jpg","Sampasjai.jpg","thaipbs บันเทิง.jpg","จุดประกาย.jpg","Split Th.jpg","Travel Here.jpg","บันทึกนักหนีเที่ยว.jpg","The Present Move.jpg","Sistacafe.jpg","ตัวตึง.jpg","Edtguide.jpg","Memosmile.jpg","Siamlandbank.jpg","Cafeteller.jpg","The Japan Foundation.jpg","The Showhopper.jpg","Chillandfin.jpg","Live To Life.jpg","Facelinenews.jpg","News Time Online.jpg","Prakan News.jpg","Tatlerasia.jpg","The Editors Society.jpg","ติดหรู - Luxe Addict.jpg","esquire.jpg","ข่าวสามสี.jpg","Friday Bangkok - En.jpg","Bunterng Thai Online.jpg","Starlightynews.jpg","Starupdate.jpg","News U.jpg","Secret.jpg","Onmag.jpg","Scala News.jpg","ไฟเขียว Greenlight-Ent..jpg","Weintrendtv.jpg","Thheadline.jpg","Stardelight.jpg","ซอกแซกดารา.jpg","News Update.jpg","Weed Ent.jpg","Woopmag.jpg","Startalk Entertainment.jpg","Update Today.jpg","King Of T-Pop.jpg","Nineentertain.mcot.net.jpg","Thedailybkk - TW.jpg","Zoomdara.jpg","Hello.98Th.jpg","Ep News.jpg","CM2.jpg","Newsway Entertainment.jpg","Thai Suptar News.jpg","The Up-Close.jpg","prsociety.jpg","Allnewsexpress1.jpg","Pr Jipata All-Stars Magazine.jpg","บันเทิง Society.jpg","Tingthinkthing.jpg","วายเลิฟยู.jpg","Kazz-magazine.com.jpg","A Nice Entertainment.jpg","Allnewsexpress.jpg","Newstimestory.com.jpg","Dailyboomm.jpg","Around Entertainment - YT.jpg","Zokzakdara.jpg","Tripleclickth.jpg","Entertainaddicted.jpg","Entown.jpg","Travelerspulse.jpg","Chieffocus.com.jpg","Aroundonline.com.jpg","Fourteen Channel.jpg","คลิปบันเทิง.jpg","The People.jpg","Hot Progress Fanpage.jpg","อวยไส้แตกแหกไส้ฉีก.jpg","Khaosodenglish.jpg","Travelandleisureasia.jpg","Fahthaimag.com.jpg","Thebeat.asia.jpg","Prjipata.com.jpg","Posh Magazine Thailand - FB.jpg","1197สายด่วนจราจร.1.jpg","News1live.com.jpg","Exhibition.contestwar.com.jpg","ททท.สำนักงานกรุงเทพมหานคร Tat Bangkok Office - FB.jpg","Harper'S Bazaar Thailand - FB.jpg","หวังสร้างเมือง - FB.jpg","The Daily Bangkok.jpg","Lookaround-th.com.jpg","Routeen.Co.jpg","Hafisbaba.jpg","Wongnaibeauty.jpg","Asianage.com.jpg","Deccanchronicle.com.jpg","Figure and Speed Skating Association of Thailand.jpg","อ อ ฟ ฟิ ศ เ ชี่ ย ว.jpg","โตแล้วไปไหนก็ได้.jpg","Zoomzogzag.com.jpg","Bangkokscoop.com.jpg","Marketingbyraj.com.jpg","Indothaitrade.com.jpg","Hunsa.jpg","มนุษย์ต่างวัย.jpg","CH8.jpg","GMM25.jpg","JKN18.jpg","True4U.jpg","Workpoint TV.jpg","Pr Thai Government.jpg","ปันโปร Punpromotion.jpg","1765 สายด่วนวัฒนธรรม - FB.jpg","Asia_Pillars_Art_Connection - IG.jpg","Bangkokthisweek - IG.jpg","Nbt connect.jpg","Newsdirectory3.com.jpg","Onb News - FB.jpg","Phigudkhaow.com.jpg","Plewseengern.jpg","Roundfinger Channel - FB.jpg","Royal World Thailand - FB.jpg","Thainews - FB.jpg","The Nation Thailand - FB.jpg","Thebangkokinsight.jpg","Top News.jpg","Wassana Nanuam.jpg","โบราณนานมา.jpg","พระลาน.jpg","Tsport7.jpg","Happy Season.jpg","โปรถังแตก.jpg","Silpthou-ศิลป์เทา.jpg","Woody.jpg","Nationthailand.com.jpg","The Matter.jpg","Vocal Academy By Pinsasinee - ครูปิ่น - IG.jpg","Thai Pbs World.jpg","Weekend Magazine.jpg","China Face.jpg","Thai.cri.cn.jpg","Ballet Reign.jpg","The Standard Pop.jpg","Fiercelive by Jijie.jpg","Mint Magazine Thailand.jpg","Lifediary.net.jpg","Biz Plus Variety.jpg","Men'S Folio Thailand.jpg","Lady Kara เลดี้คาร่า - FB.jpg","Workpointnews.jpg","singsianyerpao.jpg","Pro For Friend.jpg","Beauty.Friendster.jpg","R-u-go.com.jpg","Tastesotalk.jpg","themasterth.jpg","weeklynews.jpg","Clicknewspost.jpg","Bangkokenews.jpg","Spinstalk.jpg","Asiaconnext.jpg","thailandmovement.jpg","Guideofbangkok.jpg","Hizociety.jpg","Trendontoday.jpg","Meonlinemag.jpg","lifestylemyworld.jpg","Daybydaystory.jpg","Restmetalk.jpg","Krungthepnews.jpg","Allmiles.jpg","Greenpeace Thailand.jpg","Thethailander.jpg","Aseantime.com.jpg","Flashmove.net.jpg","94report.com.jpg","Bossmagazines.jpg","Luxuriousry.com.jpg","Beautilista.com.jpg","Insideentertain.com.jpg","ปักหมุดชิลล์.jpg","Spicybkk.jpg","mp.jpg","A.Round.jpg","Otpc News.jpg","Bizgoodness.jpg","Thaiworldtoday.jpg","Biznewsleader.jpg","Lokthurakit.jpg","Asiannewschannel1.jpg","Ujunctionnews.jpg","Bizofthai.jpg","Khaodeedee.newsnnnonline.com.jpg","Entertain.enjoyjam.net.jpg","Businessofsiam.com.jpg","Taluikhao4phak.jpg","Mars Homme.jpg","Newsgen Update.jpg","Tawansiam News.jpg","Siamsport.jpg","โซนข่าว Psi.jpg","Hello Asian.jpg","En-tk.com.jpg","En-Tk.jpg","Ipm News.jpg","Thefriendsster.jpg","Anice-entertainment.net.jpg","Gossip Pool - FB.jpg","Siamturakij.jpg","Look At Art เสพงานศิลป์ - FB.jpg","Happy Mama.jpg","Artbangkok Thailand.jpg","Go Went Korn.jpg","Visitbangkok.Thailand - FB.jpg","One More Course.jpg","77kaoded.jpg","Medi.co.th.jpg","Ladysociety.jpg","Fullnews Tv.jpg","Healthserv.net.jpg","Thainews.jpg","Pattayamail.jpg","Thaibccnews.jpg","NBTWorld.jpg","Thai Head News.jpg","การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย.jpg","Mcot ทั่วไทย.jpg","Khaosod.co.th.jpg","อัปเดตนิทรรศการศิลปะ.jpg","goplay magazine.jpg","Flying whale│วาฬมีปีก - FB.jpg","Bewlomthong.jpg","Dnext.jpg","Teen club.jpg","Brandcase.co.jpg","Starvingtime.jpg","Blyme.th.jpg","ถนัดชิม.jpg","Eco day news.jpg","The vis lit.jpg","Kindconnext.jpg","In on tour.jpg","ติดโปร.jpg","ccaptainch.jpg","Gossip pool.jpg","ใต้เตียงดารา.jpg","Poetry of bitch.jpg","บันเทิงเริงแมว.jpg","หนูน้อยบนยอดเขาอันหนาวเหน็บ.jpg","เขียนไว้ให้เธอ.jpg","Wisdom on the house.jpg","Bangkok-Online.jpg","Siamrathvariety.jpg","Neighbors and friends.jpg","1672 travel buddy.jpg","Inspiration room พื้นที่ศิลปะ ดีไซน์ และความคิดสร้างสรรค์.jpg","The design matter.jpg","Baanlaesuan.mag.jpg","Terra bkk.jpg","Sum up.jpg","Pdm brand.jpg","Theroommaker.jpg","Househub.co.jpg","Hfocus - FB.jpg","Tnn health.jpg","กรุงเทพน่าอยู่เนอะ.jpg","NBT World.jpg","Matichon book.jpg","Smethailand.jpg","Sme startup.jpg","สำนักพิมพ์ หมอชาวบ้าน.jpg","Bangkokbiznews.jpg","มาดามเม้าท์.jpg","Mplay entertrainment.jpg","Bangnainsight.jpg","ตลาด.jpg","ตลาดวิเคราะห์.jpg","RYT9.jpg","Thailand4.com.jpg","Newswit.com.jpg","Thaipr.net.jpg","Eduzones.com.jpg","Thaiedunews.net.jpg","Chairmanreview.jpg","Propholic.jpg","Banteedin108.jpg","Homeandinnovation.jpg","Fullmaป.jpg","Fullmax.jpg","pineapplenewsagency.jpg","Bizthaipost.jpg","Thecoverplus.com.jpg","Aboutliving.asia.jpg","Outaboxes.com.jpg","Propdna.net.jpg","โอภาส ใหญ่ happy investor - FB.jpg","Thecolumn.asia.jpg","Move24 bangkok.jpg","Sarakadee magazine - FB.jpg","NBT.jpg","Groundcontrol.jpg","Terrabkk.jpg","สำนักงานเขตพระนคร.jpg","หวังสร้างเมือง.jpg","ทุกข่าว.jpg","Fast fact news.jpg","Cheezepopup.jpg","Neeeeed.co.jpg","Livary.bangkok.jpg","Louderisan.jpg","โตแล้วจะไปไหนก็ได้.jpg","Greener.bangkok.go.th.jpg","balancemag.jpg","Clicknews.jpg","Bangkok Gossip.jpg","Quickpc.jpg","Techsauce.jpg","Thoughtful Media Group Thailand.jpg","Atta Gallery.jpg","art is art อะไร(แม่ง)ก็เป็นศิลปะ.jpg","Spacebar.th.jpg","Twave by Korean Updates.jpg","โอปป้าซารางเฮ.jpg","Thailandreporter.jpg","Nowentertain.jpg","Clicknews-tv.jpg","Secret_Styled.jpg","เดือนนี้ติ่งไหน.jpg","Super Scene.jpg","Star2day.jpg","Gangway Thailand.jpg","Talk in Trend.jpg","Real Ent..jpg","Banterngstation.com.jpg","questionmark.th.jpg","Jeeddyhome.jpg","Popconth.jpg","Circle Entertainment Updates.jpg","Today.Entertain.jpg","News Bunterng.jpg","Behi Entertainment.jpg","Spreadsbkk.jpg","ไปพิพิธภัณฑ์แล้วหัวใจเบิกบาน.jpg","TNews-ทีนิวส์.jpg","7days everynews.th.jpg","Brand inside - FB.jpg","TODAY Bizview.jpg","The Story Thailand - FB.jpg","Thestorythailand.jpg","Prop&travel.jpg","Bizpromptinfofanpage.jpg","Prop2morrow.jpg","BusinessIntrend.jpg","Talk About Market.jpg","Natethip.jpg","Headline.jpg","TnnWealth.jpg","Round.finger.review - IG.jpg"];

const DEFAULT_PLATFORM_REGISTRY=[
  {id:'facebook',name:'Facebook',dbCode:'FB',fileCode:'FB',builtin:true,active:true,aliases:['fb']},
  {id:'instagram',name:'Instagram',dbCode:'IG',fileCode:'IG',builtin:true,active:true,aliases:['ig']},
  {id:'x',name:'X',dbCode:'X',fileCode:'X',builtin:true,active:true,aliases:['Twitter','TW']},
  {id:'youtube',name:'YouTube',dbCode:'YT',fileCode:'YT',builtin:true,active:true,aliases:['yt']},
  {id:'tiktok',name:'TikTok',dbCode:'Tiktok',fileCode:'TK',builtin:true,active:true,aliases:[]},
  {id:'line-today',name:'LINE TODAY',dbCode:'LINE TODAY',fileCode:'LINE',builtin:true,active:true,aliases:[]},
  {id:'line',name:'LINE',dbCode:'Line',fileCode:'LINE',builtin:true,active:true,aliases:[]},
  {id:'tv',name:'TV',dbCode:'TV',fileCode:'TV',builtin:true,active:true,aliases:[]},
  {id:'website',name:'Website',dbCode:'',fileCode:'WEB',builtin:true,active:true,aliases:['Web','Online']},
  {id:'lemon8',name:'Lemon8',dbCode:'Lemon8',fileCode:'L8',builtin:true,active:true,aliases:[]},
  {id:'threads',name:'Threads',dbCode:'Threads',fileCode:'Threads',builtin:true,active:true,aliases:[]},
  {id:'msn',name:'MSN',dbCode:'Msn',fileCode:'MSN',builtin:true,active:true,aliases:[]}
];
const PLATFORM_REGISTRY_KEY='ck_platform_registry';
let _platformRegistryCache=null;

function platformId(name){
  const base=String(name||'platform').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'');
  return base||('platform-'+Date.now());
}
function normalizePlatformRecord(record){
  return{
    id:platformId(record.id||record.name),name:String(record.name||'').trim(),
    dbCode:String(record.dbCode??record.code??'').trim(),fileCode:String(record.fileCode??record.dbCode??record.code??'').trim(),
    builtin:record.builtin===true,active:record.active!==false,
    aliases:Array.isArray(record.aliases)?record.aliases.map(v=>String(v).trim()).filter(Boolean):[]
  };
}
function getPlatformRegistry(){
  if(_platformRegistryCache)return _platformRegistryCache;
  const stored=readJSON(PLATFORM_REGISTRY_KEY,[]);
  const byId=new Map(DEFAULT_PLATFORM_REGISTRY.map(p=>[p.id,normalizePlatformRecord(p)]));
  if(Array.isArray(stored))stored.forEach(raw=>{
    const p=normalizePlatformRecord(raw);if(!p.name)return;
    const base=byId.get(p.id);byId.set(p.id,base?{...base,...p,builtin:base.builtin||p.builtin}:p);
  });
  _platformRegistryCache=[...byId.values()];
  return _platformRegistryCache;
}
function savePlatformRegistry(registry){
  _platformRegistryCache=registry.map(normalizePlatformRecord).filter(p=>p.name);
  safeLS.setItem(PLATFORM_REGISTRY_KEY,JSON.stringify(_platformRegistryCache));
}
function getPlatformDefinition(value){
  const needle=String(value||'Website').trim().toLowerCase();
  return getPlatformRegistry().find(p=>p.name.toLowerCase()===needle||p.aliases.some(a=>a.toLowerCase()===needle))||null;
}
function getPlatformCode(platform,kind='db'){
  const found=getPlatformDefinition(platform);
  if(!found)return kind==='file'?String(platform||'WEB'):String(platform||'');
  return kind==='file'?found.fileCode:found.dbCode;
}
function makeDbKey(pub,platform){
  const code=getPlatformCode(platform,'db');return code?String(pub||'').trim()+' - '+code:String(pub||'').trim();
}
function activePlatforms(){return getPlatformRegistry().filter(p=>p.active);}
const SOCIAL_DOMAINS={'instagram.com':'Instagram','facebook.com':'Facebook','fb.com':'Facebook','youtube.com':'YouTube','youtu.be':'YouTube','tiktok.com':'TikTok','twitter.com':'X','x.com':'X','line.me':'LINE TODAY','lemon8-app.com':'Lemon8','lemon8.com':'Lemon8'};
const STRIP_TLDS=['.co.th','.com.th','.or.th','.in.th','.ac.th','.go.th','.mi.th','.net.th','.com','.net','.org','.edu','.gov','.io','.me','.tv','.th'];

// ═══ STORAGE ═══
function getCustom(){const v=readJSON('ck_custom',[]);return Array.isArray(v)?v:[];}
function saveCustom(a){safeLS.setItem('ck_custom',JSON.stringify(a));}
function getImported(){const v=readJSON('ck_imported',[]);return Array.isArray(v)?v:[];}
function saveImported(a){safeLS.setItem('ck_imported',JSON.stringify(a));}
function getUsernameMap(){const v=readJSON('ck_umap',{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function saveUsernameMap(m){safeLS.setItem('ck_umap',JSON.stringify(m));}

function addUsernameMapping(username,platform,pub){
  if(!username||!pub)return;
  const m=getUsernameMap();
  m[platform.toLowerCase()+':'+username.toLowerCase()]={username,platform,pub};
  saveUsernameMap(m);
}
function lookupUsername(username,platform){
  if(!username)return null;
  const m=getUsernameMap();
  const hit=m[platform.toLowerCase()+':'+username.toLowerCase()];
  if(hit)return hit.pub;
  const any=Object.values(m).find(v=>v.username.toLowerCase()===username.toLowerCase());
  return any?any.pub:null;
}
function getUsernameMappings(){return Object.values(getUsernameMap());}
function delUsernameMapping(username,platform){
  const m=getUsernameMap();
  delete m[platform.toLowerCase()+':'+username.toLowerCase()];
  saveUsernameMap(m);
}

// ═══ DB ═══
function normPlatform(p){
  const found=getPlatformDefinition(p);return found?found.name:(p||'Website');
}
function buildDB(){
  const map={};
  const norm=d=>{const platform=normPlatform(d.platform);return{...d,platform,key:makeDbKey(d.pub,platform)};};
  DB_BASE.forEach(d=>{const n=norm(d);map[n.key.toLowerCase()]=({...n,_src:'builtin'});});
  getImported().forEach(d=>{const n=norm(d);map[n.key.toLowerCase()]=({...n,_src:'imported'});});
  getCustom().forEach(d=>{const n=norm(d);map[n.key.toLowerCase()]=({...n,_src:'custom'});});
  return Object.values(map).sort((a,b)=>a.pub.toLowerCase().localeCompare(b.pub.toLowerCase()));
}
function buildIdx(db){
  const byKey={},byPub={};
  db.forEach(d=>{
    byKey[d.key.toLowerCase()]=d;
    const p=d.pub.toLowerCase();
    if(!byPub[p])byPub[p]=[];
    byPub[p].push(d);
  });
  return{byKey,byPub};
}
function buildSearchIdx(db){
  return db.map(d=>({
    ...d,
    _searchPub:(d.pub||'').toLowerCase(),
    _searchKey:(d.key||'').toLowerCase()
  }));
}
let DB=buildDB(),DBIdx=buildIdx(DB),DBSearch=buildSearchIdx(DB);
function matchDB(q, platform='', source=''){
  const needle=(q||'').trim().toLowerCase();
  return DBSearch.filter(d=>
    (!needle||d._searchPub.includes(needle)||d._searchKey.includes(needle))&&
    (!platform||d.platform===platform)&&
    (!source||d._src===source)
  );
}

// ═══ PROJECT MANAGER ═══
const PROJ_PREFIX = 'ck_proj_';
const DEFAULT_PROJ = 'default';
let _activeProj = safeLS.getItem('ck_active_proj') || DEFAULT_PROJ;

function projKey(pid){ return PROJ_PREFIX + pid; }

function getAllProjects(){
  const storedProjects=readJSON('ck_projects',[]);
  const list = (Array.isArray(storedProjects)?storedProjects:[]).map(p=>({
    ...p,
    name:p.name||'Untitled',
    clientName:p.clientName||p.name||'Untitled',
    filePattern:p.filePattern||DEFAULT_FILE_PATTERN
  }));
  // Always ensure default exists
  if(!list.find(p=>p.id===DEFAULT_PROJ)){
    list.unshift({id:DEFAULT_PROJ,name:'Default',clientName:'Default',filePattern:DEFAULT_FILE_PATTERN,created:new Date().toISOString().slice(0,10)});
  }
  safeLS.setItem('ck_projects', JSON.stringify(list));
  return list;
}

function saveProjectList(list){
  safeLS.setItem('ck_projects', JSON.stringify(list));
}

function getProjEntries(pid){
  const value=readJSON(projKey(pid),[]);
  return (Array.isArray(value)?value:[]).map(normalizeEntry);
}

function saveProjEntries(pid, arr){
  safeLS.setItem(projKey(pid), JSON.stringify(arr.map(normalizeEntry)));
}

function getActiveProject(){
  return getAllProjects().find(p=>p.id===_activeProj)||getAllProjects()[0];
}

function switchProject(pid, force){
  if(pid === _activeProj && !force) return;
  // Save current entries to current project first
  saveProjEntries(_activeProj, entries);
  // Load new project
  _activeProj = pid;
  safeLS.setItem('ck_active_proj', pid);
  // Reassign global entries
  const loaded = getProjEntries(pid);
  entries.length = 0;
  loaded.forEach(e => entries.push(e));
  // Update URL history for new project
  rebuildUrlHistory();
  updBadge();
  renderTable();
  renderRecent();
  updProjBtn();
  closeProjDD();
  const proj = getAllProjects().find(p=>p.id===pid);
  toast('📁 เปลี่ยนเป็น: '+(proj?proj.name:pid), 'ok');
}

async function createProject(){
  const inp = document.getElementById('projNewName');
  const name = (inp.value||'').trim();
  if(!name){ toast('กรอกชื่อโปรเจกต์','err'); return; }
  const id = 'proj_' + Date.now();
  const list = getAllProjects();
  list.push({id,name,clientName:name,filePattern:DEFAULT_FILE_PATTERN,created:new Date().toISOString().slice(0,10),count:0});
  saveProjectList(list);
  inp.value = '';
  switchProject(id);
  renderProjList();
  toast('✓ สร้าง "'+name+'"','ok');
  // Auto-register + create Sheet on Sheets backend (if connected)
  if(isConnected()){
    try{
      await gsCall('newProj', id, {name});
      toast('✓ สร้าง "'+name+'" + Sheet แล้ว','ok');
    }catch(e){
      // Not critical — Sheet will be created on first Sync anyway
      console.warn('newProj call failed:', e.message);
    }
  }
}

async function deleteProject(pid, e){
  e.stopPropagation();
  if(pid === DEFAULT_PROJ){ toast('ลบ Default ไม่ได้','err'); return; }
  const list = getAllProjects();
  const proj = list.find(p=>p.id===pid);
  if(!proj) return;
  if(!confirm('ลบโปรเจกต์ "'+proj.name+'" และข้อมูลทั้งหมด?')) return;
  const newList = list.filter(p=>p.id!==pid);
  saveProjectList(newList);
  safeLS.removeItem(projKey(pid));
  if(_activeProj === pid) switchProject(DEFAULT_PROJ, true);
  else renderProjList();
  toast('ลบ "'+proj.name+'" แล้ว','ok');
  // Delete Sheet on backend (if connected)
  if(isConnected()){
    try{ await gsCall('delProj', pid, {}); }
    catch(e){ console.warn('delProj call failed:', e.message); }
  }
}

function updProjBtn(){
  const proj = getAllProjects().find(p=>p.id===_activeProj);
  const nameEl = document.getElementById('projBtnName');
  if(nameEl) nameEl.textContent = proj ? proj.name : 'Default';
}

function renderProjList(){
  const el = document.getElementById('projList');
  if(!el) return;
  const list = getAllProjects();
  el.innerHTML = list.map(p => {
    const isActive = p.id === _activeProj;
    const count = getProjEntries(p.id).length;
    return `<div class="proj-item${isActive?' active':''}" data-project-id="${escAttr(p.id)}">
      <span style="font-size:16px">${isActive?'▶':'○'}</span>
      <span class="proj-item-name">${esc(p.name)}</span>
      <span class="proj-item-meta">${count} รายการ · ${p.created||''}</span>
      ${p.id!==DEFAULT_PROJ?`<button class="proj-item-del" data-delete-project="${escAttr(p.id)}" title="ลบ">✕</button>`:''}
    </div>`;
  }).join('');
}

function togProjDD(){
  const dd = document.getElementById('projDD');
  if(!dd) return;
  const isOpen = dd.classList.contains('open');
  if(isOpen){ closeProjDD(); return; }
  // Position below the button
  const btn = document.getElementById('projBtn');
  if(btn){
    const rect = btn.getBoundingClientRect();
    dd.style.top = (rect.bottom + 4) + 'px';
    const estimatedWidth=Math.max(260,dd.offsetWidth||260);
    dd.style.left = Math.max(8,Math.min(rect.left,window.innerWidth-estimatedWidth-8)) + 'px';
  }
  renderProjList();
  dd.classList.add('open');
}

function closeProjDD(){
  const dd = document.getElementById('projDD');
  if(dd) dd.classList.remove('open');
}

function migrateStorage(){
  const current=Number(safeLS.getItem('ck_schema_version')||0);
  if(current>=APP_SCHEMA_VERSION)return;
  const projects=getAllProjects();
  const snapshot={version:current,createdAt:new Date().toISOString(),projects,entriesByProject:{},custom:getCustom(),imported:getImported()};
  projects.forEach(p=>{snapshot.entriesByProject[p.id]=readJSON(projKey(p.id),[]);});
  const legacy=readJSON('ck_entries',[]);
  if(legacy.length)snapshot.legacyEntries=legacy;
  safeLS.setItem('ck_backup_pre_v'+APP_SCHEMA_VERSION,JSON.stringify(snapshot));
  if(current<2)safeLS.setItem('ck_backup_pre_v2',JSON.stringify(snapshot));

  if(current<3){
    const legacyPlatforms=readJSON('ck_custom_plats',[]);
    const registry=getPlatformRegistry();
    if(Array.isArray(legacyPlatforms))legacyPlatforms.forEach(name=>{
      if(!name||registry.some(p=>p.name.toLowerCase()===String(name).toLowerCase()))return;
      registry.push({id:platformId(name),name:String(name).trim(),dbCode:String(name).trim(),fileCode:String(name).trim(),builtin:false,active:true,aliases:[]});
    });
    savePlatformRegistry(registry);
    safeLS.removeItem('ck_custom_plats');
    saveCustom(getCustom().map(d=>({...d,platform:normPlatform(d.platform),key:makeDbKey(d.pub,d.platform)})));
    saveImported(getImported().map(d=>({...d,platform:normPlatform(d.platform),key:makeDbKey(d.pub,d.platform)})));
  }

  if(legacy.length&&!getProjEntries(DEFAULT_PROJ).length){
    saveProjEntries(DEFAULT_PROJ,legacy);
  }
  projects.forEach(project=>{
    const migrated=getProjEntries(project.id).map(entry=>({
      ...normalizeEntry(entry),
      fileName:buildOutputFileName(entry.date,entry.pub,entry.platform,project)
    }));
    saveProjEntries(project.id,migrated);
  });
  safeLS.removeItem('ck_entries');
  safeLS.setItem('ck_schema_version',String(APP_SCHEMA_VERSION));
}

// ── Consolidated global click handler (replaces 4 separate listeners) ──
// Handles: projDD close, autocomplete close, colMenu close, umap-del-btn delegation
document.addEventListener('click', function(ev){
  const t = ev.target;
  // Project dropdown
  if(!t.closest('#projBtn') && !t.closest('#projDD')) closeProjDD();
  // Autocomplete + logo suggestion dropdowns
  if(!t.closest('.acw')){const d=document.getElementById('acDrop');if(d)d.classList.remove('open');}
  if(!t.closest('.logo-sug-wrap')){const d=document.getElementById('logoSuggestions');if(d)d.classList.remove('open');}
  // Column menu
  const colMenu=document.getElementById('colMenu');
  if(colMenu&&!t.closest('#colMenuBtn')&&!t.closest('#colMenu')) colMenu.style.display='none';
  // umap-del-btn (only delegation case that uses data attributes — table/DB use inline onclick)
  if(t.classList.contains('umap-del-btn')&&t.dataset.username&&t.dataset.plat)
    delUmap(t.dataset.username,t.dataset.plat);
  if(t.dataset.validationFix!==undefined)applyValidationFix(Number(t.dataset.validationFix));
  if(t.dataset.deleteProject){deleteProject(t.dataset.deleteProject,ev);return;}
  const projectItem=t.closest('[data-project-id]');if(projectItem)switchProject(projectItem.dataset.projectId);
  if(t.dataset.customPlatform)removeCustomPlatform(t.dataset.customPlatform);
  if(t.dataset.logoSuggestion)setLogo(t.dataset.logoSuggestion);
});

// ─── entries now managed per-project ───
let entries=[]; // loaded from active project below
let editingKey=null,editingRowId=null;
const _fc=new Map();

function rebuildDB(){DB=buildDB();DBIdx=buildIdx(DB);DBSearch=buildSearchIdx(DB);_fc.clear();_logoCache.clear();_simCache.clear();}

// ═══ SIMILARITY (trigram) ═══
function normStr(s){
  return s.toLowerCase()
    // Strip TLD suffix BEFORE removing dots
    .replace(/\.(co\.th|com\.th|or\.th|in\.th|ac\.th|go\.th|mi\.th|net\.th|com|net|org|edu|gov|io|me|tv|th)$/i,'')
    // Then remove spaces, dots, dashes, underscores
    .replace(/[\s\.\-_]/g,'');
}
function similarity(a,b){
  const an=normStr(a),bn=normStr(b);
  if(an===bn)return 1;if(!an||!bn)return 0;
  const la=an.length,lb=bn.length;
  const n=Math.min(la,lb)>=5?3:2;
  const ng=s=>{const t=new Set();for(let i=0;i<=s.length-n;i++)t.add(s.slice(i,i+n));return t;};
  const ba=ng(an),bb=ng(bn);
  if(!ba.size||!bb.size)return 0;
  const inter=[...ba].filter(x=>bb.has(x)).length;
  let sc=(2*inter)/(ba.size+bb.size)||0;
  const lr=Math.min(la,lb)/Math.max(la,lb);
  if(lr>=0.80&&(an.startsWith(bn)||bn.startsWith(an)))sc=Math.max(sc,0.92);
  const[sh,lo]=la<=lb?[an,bn]:[bn,an];
  if(sh.length/lo.length>=0.70&&lo.includes(sh))sc=Math.max(sc,0.88);
  return sc;
}

// ═══ URL PARSING ═══
function titleFromUsername(raw){
  return raw.replace(/_/g,' ').replace(/\b([a-zA-Z])/g,c=>c.toUpperCase()).trim();
}
function extractWebName(h){
  let n=h.replace(/^www\./,'');
  for(const t of STRIP_TLDS.sort((a,b)=>b.length-a.length)){if(n.endsWith(t)){n=n.slice(0,-t.length);break;}}
  return n.replace(/_/g,' ').replace(/\b(\w)/g,c=>c.toUpperCase()).replace(/\s/g,'')+'.com';
}
// ─── Auto-detect date from URL path ───
// Supports: /2568/01/15/ (พ.ศ.), /2024/01/15/ (CE), /20240115/ (compact CE), /25680115/ (compact พ.ศ.)
function _parseDateFromUrl(path){
  // Buddhist Era: /2568/01/15/ or /2568/1/15/
  let m=path.match(/\/(25\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$|-)/);
  if(m){const ce=parseInt(m[1])-543,mm=String(m[2]).padStart(2,'0'),dd=String(m[3]).padStart(2,'0');
    if(ce>=2000&&ce<=2099&&+m[2]>=1&&+m[2]<=12&&+m[3]>=1&&+m[3]<=31)return ce+'-'+mm+'-'+dd;}
  // CE: /2024/01/15/
  m=path.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$|-)/);
  if(m){const mm=String(m[2]).padStart(2,'0'),dd=String(m[3]).padStart(2,'0');
    if(+m[2]>=1&&+m[2]<=12&&+m[3]>=1&&+m[3]<=31)return m[1]+'-'+mm+'-'+dd;}
  // Compact Buddhist BBBBMMDD: /25680115/ or -25680115-
  m=path.match(/[\/\-_](25\d{2})(\d{2})(\d{2})(?:[\/\-_]|$)/);
  if(m){const ce=parseInt(m[1])-543,mo=m[2],dy=m[3];
    if(ce>=2000&&ce<=2099&&+mo>=1&&+mo<=12&&+dy>=1&&+dy<=31)return ce+'-'+mo+'-'+dy;}
  // Compact CE YYYYMMDD: /20240115/
  m=path.match(/[\/\-_](20\d{2})(\d{2})(\d{2})(?:[\/\-_]|$)/);
  if(m){const y=m[1],mo=m[2],dy=m[3];
    if(+mo>=1&&+mo<=12&&+dy>=1&&+dy<=31)return y+'-'+mo+'-'+dy;}
  return '';
}

function parseUrl(url){
  if(!url)return{platform:'',pubName:'',_username:'',hint:'',canAuto:false};
  if(!url.startsWith('http'))url='https://'+url;
  try{
    const u=new URL(url),h=u.hostname.replace(/^www\./,'').toLowerCase(),path=u.pathname;
    // X
    if(h==='x.com'||h==='twitter.com'){
      const m=path.match(/^\/([^\/\?]+)\/status\//);
      if(m&&m[1]!=='i')return{platform:'X',pubName:titleFromUsername(m[1]),_username:m[1],hint:'ตรวจพบ X: @'+m[1],canAuto:true};
      return{platform:'X',pubName:'',_username:'',hint:'X — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // Facebook
    if(h==='facebook.com'||h==='fb.com'){
      const mU=path.match(/^\/([^\/\?]+)\/(posts|videos|photos|reels)\//);
      if(mU&&!/^\d+$/.test(mU[1])&&mU[1]!=='permalink.php')
        return{platform:'Facebook',pubName:titleFromUsername(mU[1]),_username:mU[1],hint:'ตรวจพบ Facebook: '+mU[1],canAuto:true};
      if(path.match(/^\/reel\//))return{platform:'Facebook',pubName:'',_username:'',hint:'Facebook Reel — กรอกชื่อสื่อเอง',canAuto:false};
      if(path.match(/^\/\d+\/(posts|videos)\//))return{platform:'Facebook',pubName:'',_username:'',hint:'Facebook Page ID — กรอกชื่อสื่อเอง',canAuto:false};
      return{platform:'Facebook',pubName:'',_username:'',hint:'Facebook — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // Instagram
    if(h==='instagram.com'){
      const mU=path.match(/^\/([^\/\?]+)\/(p|reel|tv)\//);
      if(mU&&!['p','reel','tv'].includes(mU[1]))
        return{platform:'Instagram',pubName:titleFromUsername(mU[1]),_username:mU[1],hint:'ตรวจพบ IG: @'+mU[1],canAuto:true};
      if(path.match(/^\/(p|reel|tv)\//))return{platform:'Instagram',pubName:'',_username:'',hint:'Instagram — กรอกชื่อสื่อเอง',canAuto:false};
      return{platform:'Instagram',pubName:'',_username:'',hint:'Instagram — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // YouTube
    if(h==='youtube.com'||h==='youtu.be'){
      const mA=path.match(/^\/@([^\/\?]+)/);
      if(mA)return{platform:'YouTube',pubName:titleFromUsername(mA[1]),_username:mA[1],hint:'ตรวจพบ YT: @'+mA[1],canAuto:true};
      return{platform:'YouTube',pubName:'',_username:'',hint:'YouTube — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // TikTok
    if(h==='tiktok.com'){
      const mA=path.match(/^\/@([^\/\?]+)/);
      if(mA)return{platform:'TikTok',pubName:titleFromUsername(mA[1]),_username:mA[1],hint:'ตรวจพบ TikTok: @'+mA[1],canAuto:true};
      return{platform:'TikTok',pubName:'',_username:'',hint:'TikTok — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // Threads
    if(h==='threads.net'||h==='www.threads.net'){
      const mA=path.match(/^\/@([^\/\?]+)/);
      if(mA)return{platform:'Threads',pubName:titleFromUsername(mA[1]),_username:mA[1],hint:'ตรวจพบ Threads: @'+mA[1],canAuto:true};
      return{platform:'Threads',pubName:'',_username:'',hint:'Threads — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // Lemon8 — @username pattern
    if(h==='lemon8-app.com'||h==='lemon8.com'){
      const mA=path.match(/^\/(@[^\/\?]+)/);
      const uname=mA?mA[1].replace('@',''):'';
      if(uname)return{platform:'Lemon8',pubName:titleFromUsername(uname),_username:uname,hint:'ตรวจพบ Lemon8: @'+uname,canAuto:true};
      return{platform:'Lemon8',pubName:'',_username:'',hint:'Lemon8 — กรอกชื่อสื่อเอง',canAuto:false};
    }
    // Social domains check
    for(const[d,p]of Object.entries(SOCIAL_DOMAINS)){if(h===d||h.endsWith('.'+d))return{platform:p,pubName:'',_username:'',hint:p+' — กรอกชื่อสื่อเอง',canAuto:false};}
    // Website
    const name=extractWebName(h);
    return{platform:'Website',pubName:name,_username:'',hint:'ตรวจพบเว็บไซต์: '+name,canAuto:true};
  }catch{return{platform:'',pubName:'',_username:'',hint:'',canAuto:false};}
}




// ─── Platform selector ───
function onPlatChange(){
  const val=document.getElementById('fPlat').value;
  if(val==='__manage__'){document.getElementById('fPlat').value='';openPlatformManager();return;}
  const durationRow=document.getElementById('durationRow');
  if(durationRow)durationRow.style.display=val==='TV'?'':'none';
  upAuto();onPubIn();
}

function getEffPlat(){
  const sel=document.getElementById('fPlat').value;
  return (document.getElementById('mPlat').value||'').trim()||sel;
}

function saveCustomPlat(){
  openPlatformManager();
}

// loadCustomPlats replaced by syncPlatOptions


function openManualOverride(){
  const sec=document.getElementById('manSec');
  const btn=document.getElementById('manTog');
  if(sec&&!sec.classList.contains('open')){
    sec.classList.add('open');btn.classList.add('open');
    // Focus PR input
    const prInp=document.getElementById('mPR');
    if(prInp){prInp.focus();prInp.select();}
  }
}
function onFormKeydown(e){
  if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='SELECT'){
    e.preventDefault();addEntry();
  }
}
// ═══ PLATFORM REGISTRY MANAGER ═══
let platformEditingId=null;
function getCustomPlatforms(){return getPlatformRegistry().filter(p=>!p.builtin).map(p=>p.name);}
function saveCustomPlatforms(names){
  const registry=DEFAULT_PLATFORM_REGISTRY.map(normalizePlatformRecord);
  (names||[]).forEach(name=>registry.push({id:platformId(name),name,dbCode:name,fileCode:name,builtin:false,active:true,aliases:[]}));
  savePlatformRegistry(registry);
}
function platformOptions(selected='',includeInactive=false){
  const registry=getPlatformRegistry().filter(p=>p.active||includeInactive||p.name===selected);
  return registry.map(p=>'<option value="'+escAttr(p.name)+'"'+(p.name===selected?' selected':'')+'>'+esc(p.name)+(p.active?'':' (ปิดใช้งาน)')+'</option>').join('');
}
function syncPlatOptions(){
  const configs={
    fPlat:{first:'<option value="">— เลือก —</option>',last:'<option value="__manage__">➕ เพิ่ม / จัดการ Platform...</option>'},
    qPlat:{first:''},dbPlat:{first:''},dbFPl:{first:'<option value="">ทุก Platform</option>'},
    umPlat:{first:''},expPlat:{first:'<option value="">ทั้งหมด</option>'}
  };
  Object.entries(configs).forEach(([id,cfg])=>{
    const sel=document.getElementById(id);if(!sel)return;
    const old=sel.value;sel.innerHTML=(cfg.first||'')+platformOptions(old)+(cfg.last||'');
    if([...sel.options].some(o=>o.value===old))sel.value=old;
    else if((id==='qPlat'||id==='dbPlat')&&[...sel.options].some(o=>o.value==='Website'))sel.value='Website';
  });
}
function platformUsage(name){
  const matches=v=>normPlatform(v)===name;
  let total=DB_BASE.filter(d=>matches(d.platform)).length+getCustom().filter(d=>matches(d.platform)).length+getImported().filter(d=>matches(d.platform)).length;
  getAllProjects().forEach(p=>{total+=getProjEntries(p.id).filter(e=>matches(e.platform)).length;});
  return total;
}
function renderPlatformRegistry(){
  const el=document.getElementById('platformRegistryList');if(!el)return;
  el.innerHTML=getPlatformRegistry().map(p=>{
    const usage=platformUsage(p.name);
    return '<div class="platform-row'+(p.active?'':' is-inactive')+'">'
      +'<div class="platform-main"><strong>'+esc(p.name)+'</strong><span>'+(p.builtin?'มาตรฐาน':'เพิ่มเอง')+' · ใช้ '+usage.toLocaleString('th-TH')+' รายการ</span></div>'
      +'<div class="platform-code"><span>DB</span><code>'+(p.dbCode?esc(p.dbCode):'ไม่ต่อท้าย')+'</code></div>'
      +'<div class="platform-code"><span>FILE</span><code>'+esc(p.fileCode||p.name)+'</code></div>'
      +'<div class="platform-actions"><button type="button" class="sbtn" onclick="editPlatform(\''+escAttr(p.id)+'\')">แก้ไข</button>'
      +'<button type="button" class="sbtn '+(p.active?'del':'')+'" onclick="togglePlatform(\''+escAttr(p.id)+'\')">'+(p.active?'ปิดใช้':'เปิดใช้')+'</button>'
      +(!p.builtin&&usage===0?'<button type="button" class="sbtn del" onclick="deletePlatform(\''+escAttr(p.id)+'\')">ลบ</button>':'')+'</div></div>';
  }).join('');
}
function resetPlatformForm(){
  platformEditingId=null;
  ['pmName','pmDbCode','pmFileCode'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const title=document.getElementById('pmFormTitle');if(title)title.textContent='เพิ่ม Platform ใหม่';
  const cancel=document.getElementById('pmCancelEdit');if(cancel)cancel.style.display='none';
  updatePlatformPreview();
}
function openPlatformManager(id=null){
  const modal=document.getElementById('platformModal');if(!modal)return;
  modal.style.display='flex';renderPlatformRegistry();resetPlatformForm();if(id)editPlatform(id);
  else setTimeout(()=>document.getElementById('pmName').focus(),0);
}
function closePlatformManager(){const modal=document.getElementById('platformModal');if(modal)modal.style.display='none';resetPlatformForm();}
function editPlatform(id){
  const p=getPlatformRegistry().find(row=>row.id===id);if(!p)return;
  platformEditingId=id;document.getElementById('pmName').value=p.name;document.getElementById('pmDbCode').value=p.dbCode;document.getElementById('pmFileCode').value=p.fileCode;
  document.getElementById('pmFormTitle').textContent='แก้ไข '+p.name;document.getElementById('pmCancelEdit').style.display='inline-block';updatePlatformPreview();document.getElementById('pmName').focus();
}
function updatePlatformPreview(){
  const name=(document.getElementById('pmName')?.value||'ชื่อสื่อ').trim()||'ชื่อสื่อ';
  const db=(document.getElementById('pmDbCode')?.value||'').trim();
  const file=(document.getElementById('pmFileCode')?.value||'').trim()||name;
  const dbEl=document.getElementById('pmDbPreview');if(dbEl)dbEl.textContent=db?'ตัวอย่าง: Publication - '+db:'ตัวอย่าง: Publication (ไม่ต่อท้าย)';
  const fileEl=document.getElementById('pmFilePreview');if(fileEl)fileEl.textContent='ชื่อไฟล์: 260806_Publication-'+file+'.pdf';
}
function migratePlatformReferences(oldName,newName){
  const matches=value=>String(value||'').toLowerCase()===String(oldName).toLowerCase()||normPlatform(value)===newName;
  const remap=list=>list.map(row=>matches(row.platform)?{...row,platform:newName,key:makeDbKey(row.pub,newName)}:row);
  saveCustom(remap(getCustom()));saveImported(remap(getImported()));
  getAllProjects().forEach(project=>saveProjEntries(project.id,getProjEntries(project.id).map(row=>matches(row.platform)?{...row,platform:newName,fullKey:makeDbKey(row.pub,newName),fileName:buildOutputFileName(row.date,row.pub,newName,project),updatedAt:new Date().toISOString()}:row)));
  const rebuiltMap={};getUsernameMappings().forEach(m=>{const platform=matches(m.platform)?newName:m.platform;rebuiltMap[platform.toLowerCase()+':'+m.username.toLowerCase()]={...m,platform};});saveUsernameMap(rebuiltMap);
  entries.length=0;getProjEntries(_activeProj).forEach(e=>entries.push(e));
}
function savePlatformDefinition(){
  const name=(document.getElementById('pmName').value||'').trim();
  const dbCode=(document.getElementById('pmDbCode').value||'').trim();
  const fileCode=(document.getElementById('pmFileCode').value||'').trim();
  if(!name){toast('กรอกชื่อ Platform','err');return;}
  const registry=getPlatformRegistry();const current=registry.find(p=>p.id===platformEditingId);
  if(registry.some(p=>p.id!==platformEditingId&&p.name.toLowerCase()===name.toLowerCase())){toast('ชื่อ Platform นี้มีอยู่แล้ว','err');return;}
  if(dbCode&&registry.some(p=>p.id!==platformEditingId&&p.dbCode&&p.dbCode.toLowerCase()===dbCode.toLowerCase())){toast('ตัวย่อ DB นี้ถูกใช้อยู่แล้ว','err');return;}
  if(current){
    const oldName=current.name;current.name=name;current.dbCode=dbCode;current.fileCode=fileCode;
    if(oldName!==name&&!current.aliases.includes(oldName))current.aliases.push(oldName);
    savePlatformRegistry(registry);migratePlatformReferences(oldName,name);
  }else{
    let id=platformId(name),n=2;while(registry.some(p=>p.id===id))id=platformId(name)+'-'+n++;
    registry.push({id,name,dbCode,fileCode,builtin:false,active:true,aliases:[]});savePlatformRegistry(registry);
  }
  rebuildDB();syncPlatOptions();renderPlatformRegistry();renderCustomPlatChips();renderTable();renderRecent();resetPlatformForm();
  toast('✓ บันทึก Platform: '+name,'ok');
}
function togglePlatform(id){
  const registry=getPlatformRegistry();const p=registry.find(row=>row.id===id);if(!p)return;
  p.active=!p.active;savePlatformRegistry(registry);syncPlatOptions();renderPlatformRegistry();renderCustomPlatChips();toast((p.active?'เปิดใช้ ':'ปิดใช้ ')+p.name,'ok');
}
function deletePlatform(id){
  const registry=getPlatformRegistry();const p=registry.find(row=>row.id===id);if(!p||p.builtin||platformUsage(p.name)>0)return;
  if(!confirm('ลบ Platform "'+p.name+'"?'))return;
  savePlatformRegistry(registry.filter(row=>row.id!==id));syncPlatOptions();renderPlatformRegistry();renderCustomPlatChips();resetPlatformForm();toast('ลบ '+p.name+' แล้ว','ok');
}
function addCustomPlatform(){openPlatformManager();}
function removeCustomPlatform(name){const p=getPlatformDefinition(name);if(p)togglePlatform(p.id);}
function renderCustomPlatChips(){
  const el=document.getElementById('customPlatChips');if(!el)return;
  const customs=getPlatformRegistry().filter(p=>!p.builtin&&p.active);
  el.textContent=customs.length?customs.map(p=>p.name+' · '+(p.dbCode||'ไม่มี suffix')).join(', '):'ยังไม่มี Platform ที่เพิ่มเอง';
}



// ═══ URL DEDUPLICATION ═══
const _URL_TRACKING_PARAMS = [
  'fbclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term',
  'ref','rdid','igsh','igshid','s','t','si','feature','pp','index',
  '__twitter_impression','mc_cid','mc_eid','_hsenc','_hsmi','mibextid'
];

function normalizeUrl(url){
  if(!url)return '';
  try{
    const u=new URL(url.trim().replace(/#.*$/,''));
    // Remove ONLY known tracking params (blacklist — preserve content params like ?p=)
    _URL_TRACKING_PARAMS.forEach(p=>u.searchParams.delete(p));
    // Normalize: lowercase hostname
    // Keep "/" when path is root (so ?p=123 stays as /?p=123 not ?p=123)
    const path=u.pathname===''||u.pathname==='/'?'/':u.pathname.replace(/\/+$/,'');
    let norm=u.origin.toLowerCase()+path;
    const qs=u.searchParams.toString();
    if(qs)norm+='?'+qs;
    return norm;
  }catch{return url.trim();}
}

// Cross-session URL hash store
function getUrlHistory(){
  try{return JSON.parse(safeLS.getItem('ck_url_history')||'{}');}
  catch{return {};}
}
function saveUrlHistory(h){
  try{safeLS.setItem('ck_url_history',JSON.stringify(h));}catch{}
}
function addUrlToHistory(url,entryId,pub,date){
  if(!url)return;
  const norm=normalizeUrl(url);
  if(!norm)return;
  const h=getUrlHistory();
  h[norm]={id:entryId,pub,date,added:new Date().toISOString().slice(0,10)};
  saveUrlHistory(h);
}
function checkUrlInHistory(url){
  if(!url)return null;
  const norm=normalizeUrl(url);
  if(!norm)return null;
  const h=getUrlHistory();
  return h[norm]||null;
}
function removeUrlFromHistory(url){
  if(!url)return;
  const norm=normalizeUrl(url);
  const h=getUrlHistory();
  delete h[norm];
  saveUrlHistory(h);
}

// Rebuild history from current entries (called on init)
function rebuildUrlHistory(){
  const h={};
  entries.forEach(e=>{
    if(!e.url)return;
    const norm=normalizeUrl(e.url);
    if(norm)h[norm]={id:e.id,pub:e.pub,date:e.date,added:e.date||''};
  });
  saveUrlHistory(h);
}


// ═══ GOOGLE SHEETS SYNC ═══
function getCfg(){return{url:safeLS.getItem('ck_gs_url')||'',secret:safeSession.getItem('ck_gs_secret')||''};}
function isConnected(){const c=getCfg();return !!(c.url&&c.secret);}

function updSyncBtn(){
  const btn=document.getElementById('syncBtn');
  const owb=document.getElementById('owBtn');
  const ldb=document.getElementById('loadDBBtn');
  const show=isConnected()?'':'none';
  if(btn)btn.style.display=show;
  if(owb)owb.style.display=show;
  if(ldb)ldb.style.display=show;
}
function openSettings(){
  const c=getCfg();
  const project=getActiveProject();
  const uEl=document.getElementById('cfgUrl');
  const sEl=document.getElementById('cfgSecret');
  const suEl=document.getElementById('cfgSheetUrl');
  if(uEl)uEl.value=c.url;
  if(sEl)sEl.value=c.secret;
  if(suEl)suEl.value=safeLS.getItem('ck_gs_sheeturl')||'';
  const pn=document.getElementById('cfgProjectName');if(pn)pn.value=project.clientName||project.name||'';
  const pat=document.getElementById('cfgFilePattern');if(pat)pat.value=project.filePattern||DEFAULT_FILE_PATTERN;
  updateFilePatternPreview();
  const m=document.getElementById('settingsModal');if(m)m.style.display='flex';
  setCfgSt('','');
}
function closeSettings(){const m=document.getElementById('settingsModal');if(m)m.style.display='none';}
function setCfgSt(msg,type){
  const el=document.getElementById('cfgStatus');if(!el)return;
  if(!msg){el.style.display='none';return;}
  el.style.display='block';
  el.style.background=type==='ok'?'#d1fae5':type==='err'?'#fee2e2':'#f1f5f9';
  el.style.color=type==='ok'?'#065f46':type==='err'?'#991b1b':'var(--text)';
  el.textContent=msg;
}
function saveSettings(){
  const url=(document.getElementById('cfgUrl').value||'').trim();
  const secret=(document.getElementById('cfgSecret').value||'').trim();
  const sheetUrl=(document.getElementById('cfgSheetUrl').value||'').trim();
  const projectName=(document.getElementById('cfgProjectName').value||'').trim()||getActiveProject().name;
  const filePattern=(document.getElementById('cfgFilePattern').value||'').trim()||DEFAULT_FILE_PATTERN;
  if((url&&!secret)||(!url&&secret)){setCfgSt('หากเชื่อม Google Sheets ต้องกรอก URL และ Secret Key ให้ครบ','err');return;}
  if(url&&!safeHttpUrl(url)){setCfgSt('Apps Script URL ต้องเป็น http/https ที่ถูกต้อง','err');return;}
  if(sheetUrl&&!safeHttpUrl(sheetUrl)){setCfgSt('Google Sheet URL ต้องเป็น http/https ที่ถูกต้อง','err');return;}
  const projects=getAllProjects();
  const idx=projects.findIndex(p=>p.id===_activeProj);
  if(idx>=0){projects[idx]={...projects[idx],clientName:projectName,filePattern};saveProjectList(projects);}
  entries=entries.map(e=>({...e,fileName:buildOutputFileName(e.date,e.pub,e.platform,projects[idx]),updatedAt:new Date().toISOString()}));
  saveProjEntries(_activeProj,entries);
  if(url){safeLS.setItem('ck_gs_url',url);safeSession.setItem('ck_gs_secret',secret);}
  else{safeLS.removeItem('ck_gs_url');safeSession.removeItem('ck_gs_secret');}
  if(sheetUrl)safeLS.setItem('ck_gs_sheeturl',sheetUrl);else safeLS.removeItem('ck_gs_sheeturl');
  updSyncBtn();toast('✓ บันทึกการตั้งค่าแล้ว','ok');
  renderTable();
  setTimeout(closeSettings,800);
}
function updateFilePatternPreview(){
  const el=document.getElementById('cfgFilePreview');if(!el)return;
  const patternEl=document.getElementById('cfgFilePattern');
  const nameEl=document.getElementById('cfgProjectName');
  const project={...getActiveProject(),filePattern:(patternEl&&patternEl.value)||DEFAULT_FILE_PATTERN,clientName:(nameEl&&nameEl.value)||getActiveProject().name};
  el.textContent=buildOutputFileName('2026-08-06','Zipeventapp.com','Website',project);
}
function collectBackup(){
  const projects=getAllProjects();
  const entriesByProject={};
  projects.forEach(p=>{entriesByProject[p.id]=getProjEntries(p.id);});
  return{
    app:'ClipKit',schemaVersion:APP_SCHEMA_VERSION,exportedAt:new Date().toISOString(),
    activeProject:_activeProj,projects,entriesByProject,
    mediaDatabase:{custom:getCustom(),imported:getImported()},
    usernameMap:getUsernameMap(),platformRegistry:getPlatformRegistry(),customPlatforms:getCustomPlatforms(),
    sheets:{url:safeLS.getItem('ck_gs_url')||'',sheetUrl:safeLS.getItem('ck_gs_sheeturl')||''}
  };
}
function exportBackup(){
  const backup=collectBackup();
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='ClipKit_Backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('✓ สำรองข้อมูลแล้ว','ok');
}
function isValidBackup(data){
  return data&&data.app==='ClipKit'&&Array.isArray(data.projects)&&data.entriesByProject&&typeof data.entriesByProject==='object';
}
function restoreBackup(event){
  const file=event.target.files&&event.target.files[0];
  event.target.value='';
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!isValidBackup(data))throw new Error('รูปแบบไฟล์ไม่ใช่ ClipKit Backup');
      if(!confirm('กู้คืนข้อมูลจาก '+file.name+'?\nข้อมูล Project และฐานข้อมูลปัจจุบันจะถูกแทนที่'))return;
      const current=collectBackup();
      safeLS.setItem('ck_backup_before_restore',JSON.stringify(current));
      if(Array.isArray(data.platformRegistry))savePlatformRegistry(data.platformRegistry);
      else saveCustomPlatforms(data.customPlatforms||[]);
      saveProjectList(data.projects);
      data.projects.forEach(p=>saveProjEntries(p.id,(data.entriesByProject[p.id]||[]).map(normalizeEntry)));
      saveCustom((data.mediaDatabase&&data.mediaDatabase.custom)||[]);
      saveImported((data.mediaDatabase&&data.mediaDatabase.imported)||[]);
      saveUsernameMap(data.usernameMap||{});
      if(data.sheets&&data.sheets.url)safeLS.setItem('ck_gs_url',data.sheets.url);
      if(data.sheets&&data.sheets.sheetUrl)safeLS.setItem('ck_gs_sheeturl',data.sheets.sheetUrl);
      _activeProj=data.projects.some(p=>p.id===data.activeProject)?data.activeProject:data.projects[0].id;
      safeLS.setItem('ck_active_proj',_activeProj);
      entries.length=0;getProjEntries(_activeProj).forEach(e=>entries.push(e));
      rebuildDB();rebuildUrlHistory();updProjBtn();syncPlatOptions();renderCustomPlatChips();renderTable();renderRecent();updBadge();
      closeSettings();toast('✓ กู้คืนข้อมูลแล้ว — Secret Key ต้องกรอกใหม่','ok');
    }catch(err){setCfgSt('กู้คืนไม่ได้: '+err.message,'err');}
  };
  reader.readAsText(file);
}
async function gsCall(action,project,data){
  const cfg=getCfg();if(!cfg.url)return null;
  const r=await fetch(cfg.url,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({secret:cfg.secret,action,project,data})});
  if(!r.ok)throw new Error('Sheets ตอบกลับ HTTP '+r.status);
  let json;
  try{json=await r.json();}catch{throw new Error('Sheets ไม่ได้ยืนยันผลลัพธ์เป็น JSON');}
  if(!json||json.ok===false||json.error)throw new Error((json&&json.error)||'Sheets ไม่ยืนยันการบันทึก');
  return json;
}
async function gsCallRead(action,project,data){
  const cfg=getCfg();
  if(!cfg.url) throw new Error('ยังไม่ได้ตั้งค่า Apps Script URL');
  const body=JSON.stringify({secret:cfg.secret,action,project,data});

  // Try 1: cors mode (works from GitHub Pages / http://)
  try{
    const r=await fetch(cfg.url,{
      method:'POST', mode:'cors',
      headers:{'Content-Type':'text/plain'}, // text/plain bypasses CORS preflight
      body
    });
    if(r.ok){
      const json=await r.json();
      return json;
    }
  }catch(e1){
    dmLog('cors mode ไม่ได้ ลอง no-cors... ('+e1.message+')','');
  }

  // Try 2: no-cors (file://) — can't read response, return null to signal
  try{
    await fetch(cfg.url,{method:'POST',mode:'no-cors',
      headers:{'Content-Type':'text/plain'},body});
    // no-cors = can't read response
    return {_nocors: true, entries: null};
  }catch(e2){
    throw new Error('ไม่สามารถเชื่อมต่อได้: '+e2.message);
  }
}
async function syncToSheets(){
  if(!isConnected()){openSettings();return;}
  const btn=document.getElementById('syncBtn');
  if(btn){btn.textContent='⏳...';btn.disabled=true;}
  try{
    // Append mode — ข้อมูลเก่าใน Sheet ยังอยู่
    const r=await gsCall('save',_activeProj,entries);
    const saved=r&&r.saved!=null?r.saved:entries.length;
    const skip=r&&r.skipped!=null?r.skipped:0;
    const total=r&&r.totalInSheet!=null?r.totalInSheet:'?';
    toast('☁ Sync: เพิ่ม '+saved+' รายการ'+(skip?' (ข้าม '+skip+' ซ้ำ)':''),'ok');
  }catch(e){
    toast('✗ Sync ล้มเหลว: '+e.message,'err');
  }finally{
    if(btn){btn.textContent='☁ Sync';btn.disabled=false;}
  }
}

async function overwriteSheets(){
  if(!isConnected()){openSettings();return;}
  if(!confirm('เขียนทับข้อมูลทั้งหมดใน Sheet?\nข้อมูลเก่าที่ลบใน ClipKit แล้วจะหายออกจาก Sheet ด้วย'))return;
  const btn=document.getElementById('syncBtn');
  if(btn){btn.textContent='⏳...';btn.disabled=true;}
  try{
    await gsCall('overwrite',_activeProj,entries);
    toast('☁ Overwrite สำเร็จ: '+entries.length+' รายการ','ok');
  }catch(e){
    toast('✗ Overwrite ล้มเหลว: '+e.message,'err');
  }finally{
    if(btn){btn.textContent='☁ Sync';btn.disabled=false;}
  }
}
async function autoSync(){
  if(!isConnected()) return;
  // Send only the last entry (newest) — Sheet keeps all history
  try{
    const last=entries[entries.length-1];
    if(last) await gsCall('save',_activeProj,[last]);
  }catch(e){ console.warn('autoSync failed:',e.message); }
}


// ─── DB Sync to Google Sheets ───
async function syncDBToSheets(){
  if(!isConnected()) return;
  try{
    // Collect all custom + imported entries from local DB
    const customs   = getCustom();
    const imported  = getImported();
    const all = [...customs, ...imported].map(e=>({
      pub:          e.pub||'',
      platform:     e.platform||'',
      value:        e.value||0,
      platformCode: getPlatformCode(e.platform,'db'),
      source:       e._src||'custom'
    }));
    if(!all.length) return;
    await gsCall('saveDB', null, all);
    // (log removed)
  }catch(e){ console.warn('DB sync failed:',e.message); }
}

async function loadDBFromSheets(){
  if(!isConnected()) return;
  try{
    const r = await gsCallRead('loadDB', null, null);
    if(!r||!r.entries||!r.entries.length) return;
    // Merge into local custom DB (don't overwrite built-in)
    const existing = getCustom();
    const existKeys = new Set(existing.map(e=>e.key.toLowerCase()));
    const toAdd = r.entries
      .filter(e=>e.key && !existKeys.has(e.key.toLowerCase()))
      .map(e=>({key:e.key,pub:e.pub,platform:e.platform,value:Number(e.value)||0}));
    if(toAdd.length){
      saveCustom([...existing,...toAdd]);
      rebuildDB();
      toast('✓ โหลด DB จาก Sheets: '+toAdd.length+' รายการใหม่','info');
    }
  }catch(e){ console.warn('DB load failed:',e.message); }
}


// ═══ DATA MANAGER ═══
let _lastSyncTime = safeLS.getItem('ck_last_sync') || null;

function switchDBTab(tab){
  document.getElementById('dbpanel_browse').style.display = tab==='browse' ? '' : 'none';
  document.getElementById('dbpanel_manager').style.display = tab==='manager' ? '' : 'none';
  document.querySelectorAll('.dbtab').forEach(b=>{
    b.classList.toggle('on', b.id==='dbtab_'+tab);
  });
  if(tab==='manager') dmRefresh();
}

function dmRefresh(){
  const custom   = getCustom();
  const imported = getImported();
  const all      = [...custom, ...imported];

  // Stats — show builtin + custom + imported
  const totalAll = DB.length; // full DB after rebuild
  document.getElementById('dmv_total').textContent = totalAll.toLocaleString();

  // Duplicates — same pub+platform
  const seen={}, dups=new Set();
  all.forEach(d=>{
    const k = (d.pub+'|'+d.platform).toLowerCase();
    if(seen[k]) dups.add(k); else seen[k]=d;
  });
  const dupEl=document.getElementById('dmv_dups');
  dupEl.textContent=dups.size;
  dupEl.style.color=dups.size>0?'var(--red)':'var(--green)';

  // Invalid — missing pub, platform, or value ≤ 0
  const invalid=all.filter(d=>!d.pub||!d.platform||!d.value||d.value<=0);
  const invEl=document.getElementById('dmv_invalid');
  invEl.textContent=invalid.length;
  invEl.style.color=invalid.length>0?'var(--red)':'var(--green)';

  // Last sync
  const syncEl=document.getElementById('dmv_sync');
  syncEl.textContent=_lastSyncTime||'ยังไม่เคย';

  // Show Open Sheet button if URL stored
  const sheetUrl=safeLS.getItem('ck_gs_sheeturl')||'';
  const openBtn=document.getElementById('dmOpenSheetBtn');
  if(openBtn) openBtn.style.display=sheetUrl?'':'none';
}

function dmLog(msg, type){
  const el=document.getElementById('dmLog');
  if(!el) return;
  el.style.display='block';
  const color=type==='ok'?'#059669':type==='err'?'#dc2626':type==='warn'?'#d97706':'var(--text2)';
  const prefix=type==='ok'?'✓ ':type==='err'?'✗ ':type==='warn'?'⚠ ':'  ';
  el.innerHTML += `<div style="color:${color}">${prefix}${esc(msg)}</div>`;
  el.scrollTop=el.scrollHeight;
}

function dmClearLog(){
  const el=document.getElementById('dmLog');
  if(el){el.innerHTML='';el.style.display='none';}
}

// ── Export all custom+imported DB to Sheets ──
async function dmExportAll(){
  if(!isConnected()){
    toast('ตั้งค่า Google Sheets ก่อน (กด ⚙)','err'); return;
  }
  dmClearLog();

  // Collect ALL entries: built-in + custom + imported (no duplicates by key)
  const seen = new Set();
  const all  = [];
  // Priority: custom > imported > builtin (custom overrides builtin)
  [...getCustom(),...getImported()].forEach(e=>{
    const k=(e.key||'').toLowerCase();
    if(!seen.has(k)){ seen.add(k); all.push({...e,source:e._src||'custom'}); }
  });
  DB_BASE.forEach(e=>{
    const k=(e.key||'').toLowerCase();
    if(!seen.has(k)){ seen.add(k); all.push({...e,source:'builtin'}); }
  });

  if(!all.length){ toast('ไม่มีข้อมูล','err'); return; }

  const btn=event.currentTarget;
  btn.classList.add('dm-loading');
  dmLog('เตรียม Export ทั้งหมด '+all.length+' รายการ (builtin+custom+imported)...');
  dmLog('แบ่งเป็น batch เพื่อความเสถียร...');

  // Batch export: 200 entries per call to avoid Apps Script timeout
  const BATCH = 200;
  const batches = [];
  for(let i=0;i<all.length;i+=BATCH){
    batches.push(all.slice(i,i+BATCH));
  }

  try{
    let totalSaved=0;
    for(let b=0;b<batches.length;b++){
      const batch=batches[b];
      const payload=batch.map(e=>({
        key:      e.key||'',
        pub:      e.pub||'',
        platform: e.platform||'',
        value:    Number(e.value)||0,
        source:   e.source||'builtin',
      }));
      dmLog('Batch '+(b+1)+'/'+batches.length+': '+payload.length+' รายการ...');
      // First batch: overwrite (clear + write), subsequent: append
      const action = b===0 ? 'overwriteDB' : 'saveDB';
      await gsCall(action, null, payload);
      totalSaved+=payload.length;
      // Small delay between batches to avoid quota issues
      if(b<batches.length-1) await new Promise(r=>setTimeout(r,500));
    }
    dmLog('Export สำเร็จ: '+totalSaved+' รายการ ใน '+batches.length+' batches','ok');
    dmLog('Built-in: '+DB_BASE.length+' | Custom: '+getCustom().length+' | Imported: '+getImported().length,'ok');
    toast('⬆ Export สำเร็จ: '+totalSaved+' รายการ','ok');
    _lastSyncTime=new Date().toLocaleString('th-TH');
    safeLS.setItem('ck_last_sync',_lastSyncTime);
    dmRefresh();
  }catch(e){
    dmLog('Export ล้มเหลว: '+e.message,'err');
    dmLog('ลอง re-deploy Apps Script แล้วลองใหม่','warn');
    toast('✗ Export ล้มเหลว','err');
  }finally{
    btn.classList.remove('dm-loading');
  }
}

// ── Sync from Sheets → merge into local DB (offline-first) ──
async function dmSyncFromSheets(){
  if(!isConnected()){
    toast('ตั้งค่า Google Sheets ก่อน (กด ⚙)','err'); return;
  }
  if(!confirm(
    'Sync จาก Google Sheets?\n\n' +
    '⚠ ข้อมูลใน Sheet "_db_custom" จะ เขียนทับ DB ใน ClipKit\n' +
    'ข้อมูล built-in เดิมจะถูกแทนที่ด้วยข้อมูลจาก Sheet\n\n' +
    'แน่ใจหรือไม่?'
  )) return;

  dmClearLog();
  const btn = event.currentTarget;
  btn.classList.add('dm-loading');
  dmLog('กำลัง Sync จาก Google Sheets...');

  try{
    let r;
    try {
      r = await gsCallRead('loadDB', null, null);
    } catch(fetchErr) {
      dmLog('เชื่อมต่อ Sheets ไม่ได้: ' + fetchErr.message, 'err');
      dmLog('ตรวจสอบ: 1) Apps Script Re-deploy แล้ว? 2) URL/Secret ถูก?', 'warn');
      return;
    }
    // no-cors mode (file://) — cannot read response
    if(r && r._nocors){
      dmLog('⚠ ใช้งานจาก file:// — ไม่สามารถอ่าน response ได้', 'warn');
      dmLog('วิธีแก้: Deploy ขึ้น GitHub Pages แล้ว Sync จากที่นั่น', 'warn');
      dmLog('หรือ: เปิด Chrome ด้วย --allow-file-access-from-files', 'warn');
      return;
    }
    if(!r){
      dmLog('ไม่ได้รับ response — ตรวจสอบ Apps Script URL', 'err');
      return;
    }
    if(r.error){
      dmLog('Apps Script error: ' + r.error, 'err');
      return;
    }
    if(!r.entries || !r.entries.length){
      dmLog('Sheet "_db_custom" ว่าง — กด "⬆ Export ทั้งหมด" ก่อน แล้วค่อย Sync', 'warn');
      return;
    }

    const sheetData = r.entries || [];
    dmLog('ได้รับข้อมูลจาก Sheets: ' + sheetData.length + ' รายการ');

    // Validate
    let valid = [], skipped = 0, errors = [];
    let nullValCount = 0;
    sheetData.forEach(row => {
      if(!row.pub || !row.platform){
        errors.push('ข้าม: ไม่มี pub/platform — ' + JSON.stringify(row).slice(0,40));
        skipped++; return;
      }
      let val = Number(row.value);
      if(!val || val <= 0){
        // Try fallback: look up from built-in DB_BASE
        const builtIn = DB_BASE.find(b => b.pub === row.pub && b.platform === row.platform);
        if(builtIn && builtIn.value > 0){
          val = builtIn.value;
        } else {
          nullValCount++;
          skipped++; return;
        }
      }
      // Build key
      // Use platformCode from Sheet if provided, else fallback to the registry
      const defaultCode = getPlatformCode(row.platform,'db');
      const code = (row.platformCode !== undefined && row.platformCode !== null)
        ? String(row.platformCode)
        : defaultCode;
      const key = code ? (row.pub + ' - ' + code) : row.pub;
      valid.push({ key, pub: row.pub, platform: row.platform, value: val });
    });
    if(nullValCount > 0){
      errors.push('ข้าม ' + nullValCount + ' รายการที่ไม่มี PR Value (ไม่ตรงกับ DB built-in)');
    }

    dmLog('ผ่าน validation: ' + valid.length + ' รายการ | ข้าม: ' + skipped + ' รายการ');

    if(!valid.length){
      dmLog('ไม่มีข้อมูลที่ valid — ยกเลิก Sync','err');
      return;
    }

    // ── OVERWRITE: replace DB_BASE content via imported storage ──
    // Strategy: clear imported + custom, then write all sheet data as imported
    // DB_BASE (const array) cannot be mutated directly in JS
    // So we store override in 'imported' — buildDB() gives imported priority over builtin
    saveCustom([]);          // clear custom
    saveImported(valid);     // write all sheet data as imported (overrides builtin keys)
    rebuildDB();
    renderDB();

    // Log results
    const syncTime = new Date().toLocaleString('th-TH');
    _lastSyncTime = syncTime;
    safeLS.setItem('ck_last_sync', syncTime);

    dmLog('─── Sync Results ───');
    dmLog('รายการที่ sync: ' + valid.length, 'ok');
    dmLog('ข้าม (invalid): ' + skipped, skipped ? 'warn' : 'ok');
    if(errors.length){
      dmLog('Errors (' + errors.length + '):', 'err');
      errors.slice(0,5).forEach(e => dmLog('  ' + e, 'err'));
      if(errors.length > 5) dmLog('  ...และอีก ' + (errors.length-5) + ' errors', 'err');
    }
    dmLog('✓ DB พร้อมใช้งาน offline — ' + DB.length + ' รายการ', 'ok');

    toast('⬇ Sync สำเร็จ: ' + valid.length + ' รายการจาก Sheet', 'ok');
    dmRefresh();

  }catch(e){
    dmLog('Sync ล้มเหลว: ' + e.message, 'err');
    toast('✗ Sync ล้มเหลว: ' + e.message, 'err');
  }finally{
    btn.classList.remove('dm-loading');
  }
}

// ── Audit: find duplicates + invalid ──
function dmRunAudit(){
  const all=[...getCustom(),...getImported()];
  const auditEl=document.getElementById('dmAudit');
  const auditBody=document.getElementById('dmAuditBody');
  if(!auditEl||!auditBody) return;

  dmClearLog();
  dmLog('กำลัง Audit '+all.length+' รายการ...');

  const seen={};
  const issues=[];

  all.forEach(d=>{
    const k=(d.pub+'|'+d.platform).toLowerCase();
    // Duplicate
    if(seen[k]){
      issues.push({type:'dup', badge:'ซ้ำ', d,
        msg:'"'+d.pub+'" ['+d.platform+'] มีซ้ำ '+
            (seen[k].value!==d.value?'(value ต่างกัน: ฿'+seen[k].value.toLocaleString()+' vs ฿'+d.value.toLocaleString()+')':'(value เหมือนกัน)')});
    } else { seen[k]=d; }
    // Invalid value
    if(!d.value||d.value<=0){
      issues.push({type:'inv', badge:'Invalid', d,
        msg:'"'+d.pub+'" ['+d.platform+'] — PR Value ไม่ถูกต้อง: '+d.value});
    }
    // Missing platform
    if(!d.platform){
      issues.push({type:'inv', badge:'No Platform', d,
        msg:'"'+d.pub+'" — ไม่มี platform'});
    }
  });

  auditEl.style.display='block';

  if(!issues.length){
    auditBody.innerHTML='<div style="padding:20px;text-align:center;color:var(--green);font-weight:700;font-size:14px">✓ ไม่พบปัญหา — ข้อมูลสะอาด</div>';
    dmLog('Audit เสร็จ: ไม่พบปัญหา','ok');
    return;
  }

  auditBody.innerHTML=issues.map(i=>`
    <div class="audit-row">
      <span class="audit-badge ${i.type==='dup'?'ab-dup':'ab-inv'}">${esc(i.badge)}</span>
      <span style="flex:1">${esc(i.msg)}</span>
      <span style="font-size:10px;color:var(--text3);flex-shrink:0">${esc(i.d.key||'')}</span>
    </div>`).join('');

  dmLog('Audit เสร็จ: พบ '+issues.length+' ปัญหา ('+
    issues.filter(i=>i.type==='dup').length+' ซ้ำ, '+
    issues.filter(i=>i.type==='inv').length+' invalid)','warn');
  dmRefresh();
}

// ── Open Google Sheet ──
function dmOpenSheet(){
  const url=safeLS.getItem('ck_gs_sheeturl')||'';
  const safe=safeHttpUrl(url);
  if(!safe){ toast('Sheet URL ไม่ถูกต้องหรือไม่ใช่ http/https','err'); return; }
  window.open(safe,'_blank','noopener,noreferrer');
}

// ═══ VALIDATION ENGINE ═══
let _lastDetectedPub='', _lastDetectedPlat='';

// Called by onUrl to store detected values for later validation
function setDetected(pub, plat){
  _lastDetectedPub = pub||'';
  _lastDetectedPlat = plat||'';
}

function _getFormValues(){
  return {
    pub:  (document.getElementById('mPub').value||'').trim()||(document.getElementById('fPub').value||'').trim(),
    plat: (document.getElementById('mPlat').value||'').trim()||getEffPlat(),
    date: document.getElementById('fDate').value||'',
    url:  (document.getElementById('mLink').value||'').trim()||(document.getElementById('fUrl').value||'').trim(),
  };
}
function _validateRequired({pub,plat,date}){
  const errors=[];
  if(!date) errors.push({msg:'กรุณาเลือก DATE',fix:null});
  if(!pub)  errors.push({msg:'กรุณากรอกชื่อสื่อ (PUBLICATION)',fix:null});
  if(!plat) errors.push({msg:'กรุณาเลือก PLATFORM',fix:null});
  return errors;
}
// _validatePlatformMatch, _validatePubMatch, _validateDate removed — never called (logic lives in runValidation)
function _validateDuplicate({pub,plat,date,url}){
  const warnings=[];
  if(url){
    const normUrl=normalizeUrl(url);
    const exactDupe=entries.find(e=>e.url&&normalizeUrl(e.url)===normUrl);
    if(exactDupe){
      return [{type:'err',msg:`URL นี้มีอยู่แล้ว: ${exactDupe.pub} (${exactDupe.date})`,
        fix:'ดูรายการ',fixAction:'highlight',fixValue:exactDupe.id}];
    }
  }
  if(pub&&plat&&date){
    const dupes=entries.filter(e=>e.pub.toLowerCase()===pub.toLowerCase()&&e.platform===plat&&e.date===date);
    if(dupes.length) warnings.push({type:'warn',
      msg:`"${pub}" [${plat}] ลงรายการวันนี้แล้ว ${dupes.length} ครั้ง`,
      fix:'ดู',fixAction:'highlight',fixValue:dupes[dupes.length-1].id});
  }
  return warnings;
}

function runValidation(){
  const vals=_getFormValues();
  const {pub,plat,date,url}=vals;
  const errors=[..._validateRequired(vals)];
  const warnings=[];

  // Duplicate check (can produce error)
  const dupResults=_validateDuplicate(vals);
  dupResults.forEach(r=>r.type==='err'?errors.push(r):warnings.push(r));

  if(pub && plat && date){
    // ── WARNING: Platform mismatch with URL ──
    if(url && _lastDetectedPlat && _lastDetectedPlat!==plat){
      const manPlat=(document.getElementById('mPlat').value||'').trim();
      if(!manPlat){ // only warn if not manually overriding
        warnings.push({
          msg:`Platform ไม่ตรงกับ URL: URL detect ได้ "${_lastDetectedPlat}" แต่เลือก "${plat}"`,
          fix:'ใช้ '+_lastDetectedPlat,
          fixAction:'platform',fixValue:_lastDetectedPlat
        });
      }
    }

    // ── WARNING: Publication mismatch with URL ──
    if(url && _lastDetectedPub && _lastDetectedPub.trim()){
      const detNorm=normStr(_lastDetectedPub);
      const pubNorm=normStr(pub);
      const sc=similarity(_lastDetectedPub, pub);
      if(sc < 0.60 && detNorm !== pubNorm){
        warnings.push({
          msg:`Publication อาจไม่ตรง: URL detect ได้ "${_lastDetectedPub}" แต่กรอก "${pub}"`,
          fix:'ใช้ '+_lastDetectedPub,
          fixAction:'publication',fixValue:_lastDetectedPub
        });
      }
    }

    // ── WARNING: Date in future ──
    const today=new Date().toISOString().slice(0,10);
    if(date>today){
      warnings.push({msg:'DATE เป็นอนาคต ('+date+') — ตรวจสอบอีกครั้ง', fix:'วันนี้',
        fixAction:'date',fixValue:today});
    }
    // NOTE: URL dup + same-day dup already handled by _validateDuplicate() above — not repeated here
  }

  return{errors, warnings};
}


function showDupBadge(autoScrollId){
  const badge = document.getElementById('dupBadge');
  if(badge) badge.style.display = 'inline';
  // Auto-scroll to the duplicate row immediately
  if(autoScrollId != null) highlightEntry(autoScrollId);
}

function hideDupBadge(){
  const badge = document.getElementById('dupBadge');
  if(badge) badge.style.display = 'none';
  clearDupHighlight();
}

let _validationEnabled = false; // only activate after user starts filling form
let _validationItems=[];

function applyValidationFix(index){
  const item=_validationItems[index];if(!item)return;
  if(item.fixAction==='highlight')highlightEntry(Number(item.fixValue));
  if(item.fixAction==='platform'){document.getElementById('fPlat').value=item.fixValue;_autoFilledPlat=false;onPubIn();}
  if(item.fixAction==='publication'){document.getElementById('fPub').value=item.fixValue;_autoFilledPub=false;}
  if(item.fixAction==='date')document.getElementById('fDate').value=item.fixValue;
  upAuto();renderValidation();
}

function renderValidation(){
  // Don't validate on init — only after user interacts
  if(!_validationEnabled) return;
  const {errors, warnings} = runValidation();
  const strip = document.getElementById('valStrip');
  const btn = document.getElementById('btnAdd');
  if(!strip||!btn) return;

  const all = [
    ...errors.map(e=>({...e, type:'err'})),
    ...warnings.map(w=>({...w, type:'warn'}))
  ];

  // Sync dup badge
  const dupErr = all.find(i=>i.type==='err'&&i.msg&&i.msg.includes('URL'));
  const dupWarn = all.find(i=>i.type==='warn'&&i.msg&&i.msg.includes('URL'));
  const dupItem = dupErr || dupWarn;
  if(dupItem && dupItem.fixAction==='highlight'){
    showDupBadge(Number(dupItem.fixValue));
  } else {
    hideDupBadge();
  }

  if(!all.length){
    strip.style.display='none';
    btn.classList.remove('has-warn','has-err');
    return;
  }

  strip.style.display='block';
  _validationItems=all;
  strip.innerHTML = all.map((item,i)=>`
    <div class="val-item val-${item.type}">
      <span class="val-icon">${item.type==='err'?'🔴':'🟡'}</span>
      <span class="val-msg">${esc(item.msg)}${item.fix&&item.fixAction?`<button class="val-fix" type="button" data-validation-fix="${i}">ใช้ ${esc(item.fix)}</button>`:''}</span>
      <button onclick="this.closest('.val-item').remove();if(!document.querySelector('#valStrip .val-item')){document.getElementById('valStrip').style.display='none';document.getElementById('btnAdd').classList.remove('has-warn','has-err');}" style="background:none;border:none;cursor:pointer;color:inherit;opacity:.5;font-size:14px;padding:0 0 0 6px;flex-shrink:0" title="ปิด">×</button>
    </div>`).join('');

  btn.classList.remove('has-warn','has-err');
  if(errors.length) btn.classList.add('has-err');
  else if(warnings.length) btn.classList.add('has-warn');
}

// Clear validation when form cleared
function clearValidation(){
  _validationEnabled = false;
  // Clear URL dup state so next entry starts fresh
  _lastDetectedPub=''; _lastDetectedPlat='';
  const strip=document.getElementById('valStrip');
  if(strip)strip.style.display='none';
  const btn=document.getElementById('btnAdd');
  if(btn)btn.classList.remove('has-warn','has-err');
  hideDupBadge();
}

// Track fields auto-filled by URL detection
let _autoFilledPub=false, _autoFilledPlat=false, _autoFilledDate=false;

function _showUrlHint(dot, txt, color, textColor, message){
  const hintEl=document.getElementById('urlHint');
  const dotEl=document.getElementById('hintDot');
  const txtEl=document.getElementById('hintTxt');
  if(!hintEl||!dotEl||!txtEl) return;
  hintEl.classList.add('show');
  dotEl.style.background=color;
  txtEl.style.color=textColor;
  txtEl.textContent=message;
}
function _hideUrlHint(){
  const hintEl=document.getElementById('urlHint');
  if(hintEl) hintEl.classList.remove('show');
}
function _clearUrlAutoFill(){
  const pubEl=document.getElementById('fPub');
  const platEl=document.getElementById('fPlat');
  const dateEl=document.getElementById('fDate');
  if(_autoFilledPub&&pubEl){pubEl.value='';_autoFilledPub=false;}
  if(_autoFilledPlat&&platEl){platEl.value='';_autoFilledPlat=false;}
  if(_autoFilledDate&&dateEl){dateEl.value=new Date().toISOString().slice(0,10);_autoFilledDate=false;}
}

function onUrl(){
  _validationEnabled = true;
  const url=(document.getElementById('fUrl').value||'').trim();
  const pubEl=document.getElementById('fPub');
  const platEl=document.getElementById('fPlat');

  if(!url){
    _hideUrlHint();
    _clearUrlAutoFill();
    hideDupBadge();
    setDetected('','');
    upAuto();
    return;
  }
  clearDupHighlight();

  const r=parseUrl(url);

  // Auto-detect date from URL path
  let _urlDate='';
  try{const _up=new URL(url.startsWith('http')?url:'https://'+url);_urlDate=_parseDateFromUrl(_up.pathname);}catch{}
  const dateEl=document.getElementById('fDate');
  if(_urlDate&&dateEl&&(!dateEl.value||_autoFilledDate)){
    dateEl.value=_urlDate;_autoFilledDate=true;
  }
  const _dateSuffix=_urlDate&&_autoFilledDate?' | 📅 '+_urlDate:'';

  // Set platform
  if(r.platform){
    platEl.value=r.platform;
    _autoFilledPlat=true;
  }

  const mapped=r._username?lookupUsername(r._username,r.platform):null;
  if(mapped){
    if(!pubEl.value.trim()||_autoFilledPub){pubEl.value=mapped;_autoFilledPub=true;}
    _showUrlHint(null,null,'#4f46e5','#4f46e5','@'+r._username+' → '+mapped+' (จำแล้ว ✓)'+_dateSuffix);
  }else if(r.canAuto&&r.pubName){
    if(!pubEl.value.trim()||_autoFilledPub){pubEl.value=r.pubName;_autoFilledPub=true;}
    _showUrlHint(null,null,'#059669','#059669',r.hint+_dateSuffix);
  }else if(r.hint){
    if(_autoFilledPub){pubEl.value='';_autoFilledPub=false;}
    _showUrlHint(null,null,'#f59e0b','#92400e',r.hint+_dateSuffix);
  }else if(_urlDate){
    _showUrlHint(null,null,'#059669','#059669','📅 จับวันที่จาก URL: '+_urlDate);
  }else{
    _hideUrlHint();
  }
  // Auto-clean URL (strip tracking params)
  if(url){
    const norm=normalizeUrl(url);
    if(norm&&norm!==url&&norm.startsWith('http')){
      const urlEl=document.getElementById('fUrl');
      if(urlEl)urlEl.value=norm;
    }
  }
  // Store detected values for validation
  setDetected(
    mapped||((r.canAuto&&r.pubName)?r.pubName:''),
    r.platform||''
  );
  upAuto();
}


// ─── Performance utilities ───
function debounce(fn, ms){
  let t;
  return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); };
}
function ensureXLSX(){
  if(window.XLSX) return true;
  toast('โหลด Excel library ไม่สำเร็จ — ต่ออินเทอร์เน็ตแล้วเปิดไฟล์ใหม่อีกครั้ง','err');
  return false;
}

// Logo cache — avoid scanning 728 files on every upAuto()
const _logoCache = new Map();
function findLogoFast(pub){
  if(!pub) return {file:'', score:0};
  const ck = pub.toLowerCase();
  if(_logoCache.has(ck)) return _logoCache.get(ck);
  let best='', bestSc=0;
  for(const logo of LOGO_FILES){
    const sc = similarity(pub, logo.replace(/\.(jpg|jpeg)$/i,''));
    if(sc > bestSc){ bestSc=sc; best=logo; }
  }
  const result = bestSc >= 0.70 ? {file:best, score:bestSc} : {file:'', score:0};
  _logoCache.set(ck, result);
  return result;
}

// Similarity early-exit — skip if length ratio too far apart
const _simCache = new Map();
function similarityFast(a, b){
  const k = a+'||'+b;
  if(_simCache.has(k)) return _simCache.get(k);
  // Early exit: if normalized lengths differ > 3x, can't possibly be similar
  const an=normStr(a), bn=normStr(b);
  if(!an||!bn){ _simCache.set(k,0); return 0; }
  if(an===bn){ _simCache.set(k,1); return 1; }
  const ratio = Math.min(an.length,bn.length)/Math.max(an.length,bn.length);
  if(ratio < 0.3){ _simCache.set(k,0); return 0; }
  const sc = similarity(a, b);
  _simCache.set(k, sc);
  return sc;
}

// ═══ LOOKUP ═══
function lookupPR(pub,plat){
  if(!pub)return null;
  const k=makeDbKey(pub,plat).toLowerCase();
  // 1. Exact key O(1)
  if(DBIdx.byKey[k])return DBIdx.byKey[k];
  // 2. Exact pub name O(1) — prefer same platform
  const pn=pub.toLowerCase();
  if(DBIdx.byPub[pn]){
    const same=DBIdx.byPub[pn].find(d=>d.platform===plat||normPlatform(d.platform)===plat);
    return same||DBIdx.byPub[pn][0];
  }
  // 3. Fuzzy ≥0.75 — check cache first
  const ck=pn+'|'+plat;
  if(_fc.has(ck))return _fc.get(ck);
  // Platform-filtered first (faster), then full DB fallback
  const platVariants=[plat,'Web','Website'].filter(Boolean);
  const pool=DB.filter(d=>platVariants.includes(d.platform));
  let best=null,bestSc=0;
  for(const d of pool){const sc=similarityFast(pub,d.pub);if(sc>=0.75&&sc>bestSc){best=d;bestSc=sc;}}
  if(!best){for(const d of DB){const sc=similarityFast(pub,d.pub);if(sc>=0.75&&sc>bestSc){best=d;bestSc=sc;}}}
  _fc.set(ck,best);return best;
}
// [BUG FIX] Removed duplicate findLogoFast definition (was overriding the cached version above)
function filenamePart(value){
  return String(value||'')
    .replace(/[\\/:*?"<>|]/g,'-')
    .replace(/\s+/g,'')
    .replace(/-+/g,'-')
    .replace(/^[.\-_]+|[.\-_]+$/g,'')||'Untitled';
}
function buildOutputFileName(date,pub,plat,project){
  if(!date||!pub)return '';
  const compact=String(date).replace(/-/g,'');
  const yymmdd=compact.length===8?compact.slice(2):compact;
  const proj=project||getActiveProject();
  const pattern=(proj&&proj.filePattern)||DEFAULT_FILE_PATTERN;
  let output=pattern
    .replaceAll('{YYMMDD}',yymmdd)
    .replaceAll('{Publication}',filenamePart(pub))
    .replaceAll('{Platform}',filenamePart(getPlatformCode(plat,'file')||plat||'WEB'))
    .replaceAll('{Project}',filenamePart((proj&&proj.clientName)||(proj&&proj.name)||'ClipKit'));
  output=output.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'_');
  if(!/\.pdf$/i.test(output))output+='.pdf';
  return output;
}
function buildFN(date,pub,plat){return buildOutputFileName(date,pub,plat);}
function fmtPR(v){return v!=null?'฿'+Number(v).toLocaleString('th-TH'):'—';}

// ═══ PHASE 2: CAPTURE LIBRARY + PDF ═══
const CAPTURE_DB_NAME='clipkit-captures';
const CAPTURE_DB_VERSION=1;
const CAPTURE_STORE='captures';
let _captureDBPromise=null,_captureEntryId=null,_captureImages=[];

function captureRecordKey(projectId,entryId){return String(projectId)+':'+String(entryId);}
function openCaptureDB(){
  if(_captureDBPromise)return _captureDBPromise;
  _captureDBPromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('เบราว์เซอร์นี้ไม่รองรับพื้นที่เก็บภาพ'));return;}
    const req=indexedDB.open(CAPTURE_DB_NAME,CAPTURE_DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(CAPTURE_STORE))db.createObjectStore(CAPTURE_STORE,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('เปิดคลังภาพไม่ได้'));
  });
  return _captureDBPromise;
}
async function getCaptureRecord(projectId,entryId){
  const db=await openCaptureDB();
  return new Promise((resolve,reject)=>{const req=db.transaction(CAPTURE_STORE,'readonly').objectStore(CAPTURE_STORE).get(captureRecordKey(projectId,entryId));req.onsuccess=()=>resolve(req.result||{key:captureRecordKey(projectId,entryId),projectId,entryId,images:[]});req.onerror=()=>reject(req.error);});
}
async function saveCaptureRecord(projectId,entryId,images){
  const db=await openCaptureDB();
  const record={key:captureRecordKey(projectId,entryId),projectId,entryId,images,updatedAt:new Date().toISOString()};
  return new Promise((resolve,reject)=>{const req=db.transaction(CAPTURE_STORE,'readwrite').objectStore(CAPTURE_STORE).put(record);req.onsuccess=()=>resolve(record);req.onerror=()=>reject(req.error);});
}
async function deleteCaptureRecord(projectId,entryId){
  try{const db=await openCaptureDB();return await new Promise((resolve,reject)=>{const req=db.transaction(CAPTURE_STORE,'readwrite').objectStore(CAPTURE_STORE).delete(captureRecordKey(projectId,entryId));req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});}
  catch(err){console.warn('[ClipKit] ล้างคลังภาพไม่ได้:',err.message);}
}
function fileAsDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});}
function loadImageSource(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('อ่านไฟล์ภาพไม่ได้'));img.src=src;});}
function captureTargetSize(width,height,maxWidth=2200,maxPixels=15000000,maxHeight=10000){
  let scale=Math.min(1,maxWidth/width,maxHeight/height,Math.sqrt(maxPixels/(width*height)));
  if(!Number.isFinite(scale)||scale<=0)scale=1;
  return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),scale};
}
function capturePageSlices(width,height,pageWidth=595.28,pageHeight=841.89,margin=28){
  const contentWidth=pageWidth-margin*2,contentHeight=pageHeight-margin*2;
  const scale=contentWidth/width,sliceHeight=Math.max(1,Math.floor(contentHeight/scale));
  const slices=[];for(let y=0;y<height;y+=sliceHeight)slices.push({y,height:Math.min(sliceHeight,height-y)});
  return slices;
}
async function prepareCaptureFile(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('รองรับเฉพาะไฟล์ภาพ');
  if(file.size>30*1024*1024)throw new Error('ภาพใหญ่เกิน 30 MB');
  const original=await fileAsDataURL(file),img=await loadImageSource(original);
  const size=captureTargetSize(img.naturalWidth,img.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  canvas.getContext('2d').drawImage(img,0,0,size.width,size.height);
  return{id:'cap-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:file.name||'clipboard.png',type:'image/jpeg',dataUrl:canvas.toDataURL('image/jpeg',.9),width:size.width,height:size.height,createdAt:new Date().toISOString()};
}
async function openCapture(entryId){
  const entry=entries.find(e=>e.id===Number(entryId));if(!entry)return;
  _captureEntryId=entry.id;
  const modal=document.getElementById('captureModal');modal.style.display='flex';
  document.getElementById('capturePub').textContent=entry.pub;
  document.getElementById('captureMeta').textContent=[entry.date,entry.platform,fmtPR(entry.prValue)].filter(Boolean).join(' · ');
  const source=document.getElementById('captureSource');source.textContent=entry.url||'รายการนี้ยังไม่มี URL';source.title=entry.url||'';
  document.getElementById('captureFileName').textContent=buildOutputFileName(entry.date,entry.pub,entry.platform,getActiveProject());
  setCaptureStatus('กำลังเปิดคลังภาพ…','');
  try{const record=await getCaptureRecord(_activeProj,entry.id);_captureImages=Array.isArray(record.images)?record.images:[];renderCaptureImages();setCaptureStatus('','');}
  catch(err){_captureImages=[];renderCaptureImages();setCaptureStatus(err.message,'err');}
  setTimeout(()=>document.getElementById('capturePasteZone').focus(),0);
}
function closeCapture(){document.getElementById('captureModal').style.display='none';_captureEntryId=null;_captureImages=[];document.getElementById('captureInput').value='';}
function openCaptureSource(){const entry=entries.find(e=>e.id===_captureEntryId);const url=entry&&safeHttpUrl(entry.url);if(!url){toast('รายการนี้ยังไม่มี URL ที่เปิดได้','err');return;}window.open(url,'_blank','noopener,noreferrer');}
function setCaptureStatus(message,type=''){const el=document.getElementById('captureStatus');if(!el)return;el.textContent=message;el.className='capture-status '+type;el.style.display=message?'block':'none';}
async function addCaptureFiles(files){
  const list=[...(files||[])].filter(f=>String(f.type||'').startsWith('image/'));if(!list.length){toast('ไม่พบไฟล์ภาพ','err');return;}
  setCaptureStatus('กำลังเตรียมภาพ 0/'+list.length,'busy');
  try{
    for(let i=0;i<list.length;i++){setCaptureStatus('กำลังเตรียมภาพ '+(i+1)+'/'+list.length,'busy');_captureImages.push(await prepareCaptureFile(list[i]));}
    await persistCaptureImages();setCaptureStatus('บันทึก '+list.length+' ภาพแล้ว','ok');
  }catch(err){setCaptureStatus(err.message,'err');}
  document.getElementById('captureInput').value='';
}
function onCaptureInput(event){addCaptureFiles(event.target.files);}
function onCapturePaste(event){
  if(document.getElementById('captureModal').style.display==='none')return;
  const files=[...(event.clipboardData&&event.clipboardData.items||[])].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
  if(files.length){event.preventDefault();addCaptureFiles(files);}
}
async function persistCaptureImages(){
  await saveCaptureRecord(_activeProj,_captureEntryId,_captureImages);
  const idx=entries.findIndex(e=>e.id===_captureEntryId);if(idx>=0){entries[idx]={...entries[idx],captureCount:_captureImages.length,capturedAt:_captureImages.length?new Date().toISOString():'',status:_captureImages.length&&(entries[idx].status||'draft')==='draft'?'captured':entries[idx].status,updatedAt:new Date().toISOString()};saveProjEntries(_activeProj,entries);}
  renderCaptureImages();renderTable();updBadge();
}
async function removeCaptureImage(id){if(!confirm('ลบภาพนี้ออกจากรายการข่าว?'))return;_captureImages=_captureImages.filter(img=>img.id!==id);await persistCaptureImages();setCaptureStatus('ลบภาพแล้ว','ok');}
async function moveCaptureImage(id,direction){const i=_captureImages.findIndex(img=>img.id===id),next=i+direction;if(i<0||next<0||next>=_captureImages.length)return;[_captureImages[i],_captureImages[next]]=[_captureImages[next],_captureImages[i]];await persistCaptureImages();}
function renderCaptureImages(){
  const list=document.getElementById('captureList'),empty=document.getElementById('captureEmpty'),count=document.getElementById('captureCount');
  count.textContent=_captureImages.length+' ภาพ';empty.style.display=_captureImages.length?'none':'flex';
  list.innerHTML=_captureImages.map((img,i)=>'<article class="capture-card"><div class="capture-order">'+String(i+1).padStart(2,'0')+'</div><img src="'+escAttr(img.dataUrl)+'" alt="ภาพแคป '+(i+1)+'"><div class="capture-card-meta"><strong>'+esc(img.name)+'</strong><span>'+img.width+' × '+img.height+' px</span></div><div class="capture-card-actions"><button type="button" onclick="moveCaptureImage(\''+img.id+'\',-1)" '+(i===0?'disabled':'')+' title="เลื่อนขึ้น">↑</button><button type="button" onclick="moveCaptureImage(\''+img.id+'\',1)" '+(i===_captureImages.length-1?'disabled':'')+' title="เลื่อนลง">↓</button><button type="button" class="danger" onclick="removeCaptureImage(\''+img.id+'\')" title="ลบภาพ">×</button></div></article>').join('');
  document.getElementById('captureExportBtn').disabled=!_captureImages.length;
}
function wrapCanvasText(ctx,text,maxWidth){
  const words=String(text||'').split(/\s+/),lines=[];let line='';
  words.forEach(word=>{const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;});if(line)lines.push(line);return lines;
}
function captureCoverData(entry,imageCount,fileName){
  const c=document.createElement('canvas');c.width=1240;c.height=1754;const x=c.getContext('2d');
  x.fillStyle='#f8fafc';x.fillRect(0,0,c.width,c.height);x.fillStyle='#0f172a';x.fillRect(0,0,c.width,26);x.fillStyle='#0f766e';x.fillRect(82,110,78,12);
  x.fillStyle='#64748b';x.font='600 24px "DM Sans",sans-serif';x.fillText('CLIPKIT / NEWS COVERAGE',82,178);
  x.fillStyle='#0f172a';x.font='700 74px "DM Sans",sans-serif';let y=310;wrapCanvasText(x,entry.pub,1040).slice(0,3).forEach(line=>{x.fillText(line,82,y);y+=88;});
  x.fillStyle='#475569';x.font='500 32px "DM Sans",sans-serif';wrapCanvasText(x,entry.headline||'Clipping evidence',1040).slice(0,4).forEach(line=>{x.fillText(line,82,y+18);y+=46;});
  y=Math.max(y+90,700);x.strokeStyle='#cbd5e1';x.lineWidth=2;x.beginPath();x.moveTo(82,y);x.lineTo(1158,y);x.stroke();y+=78;
  const rows=[['DATE',entry.date||'-'],['PLATFORM',entry.platform||'-'],['PR VALUE',fmtPR(entry.prValue)],['CAPTURE PAGES',String(imageCount)],['PDF FILE',fileName]];
  rows.forEach(([label,value])=>{x.fillStyle='#94a3b8';x.font='700 20px "DM Sans",sans-serif';x.fillText(label,82,y);x.fillStyle='#0f172a';x.font='600 29px "DM Sans",sans-serif';wrapCanvasText(x,value,820).slice(0,2).forEach((line,j)=>x.fillText(line,330,y+j*38));y+=74;});
  if(entry.url){y+=30;x.fillStyle='#94a3b8';x.font='700 20px "DM Sans",sans-serif';x.fillText('SOURCE URL',82,y);y+=42;x.fillStyle='#334155';x.font='500 22px "DM Sans",sans-serif';wrapCanvasText(x,entry.url,1076).slice(0,4).forEach(line=>{x.fillText(line,82,y);y+=34;});}
  x.fillStyle='#0f766e';x.font='700 24px "DM Sans",sans-serif';x.fillText('Prepared with ClipKit',82,1650);x.fillStyle='#94a3b8';x.font='500 20px "DM Sans",sans-serif';x.fillText(new Date().toLocaleString('th-TH'),900,1650);
  return c.toDataURL('image/jpeg',.92);
}
function dataUrlBinary(dataUrl){
  const base64=String(dataUrl).split(',')[1]||'',raw=atob(base64),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;
}
function joinByteArrays(parts){const total=parts.reduce((sum,p)=>sum+p.length,0),out=new Uint8Array(total);let offset=0;parts.forEach(p=>{out.set(p,offset);offset+=p.length;});return out;}
function pdfTextBytes(text){return new TextEncoder().encode(text);}
function buildImagePDFBlob(images,pageWidth=595.28,pageHeight=841.89,margin=28){
  if(!images.length)throw new Error('ไม่มีภาพสำหรับ PDF');
  const objectCount=2+images.length*3,objects=new Array(objectCount+1),kids=[];
  objects[1]=pdfTextBytes('<< /Type /Catalog /Pages 2 0 R >>');
  images.forEach((image,index)=>{
    const pageObj=3+index*3,contentObj=pageObj+1,imageObj=pageObj+2;kids.push(pageObj+' 0 R');
    const imageBytes=dataUrlBinary(image.dataUrl),availableW=pageWidth-margin*2,availableH=pageHeight-margin*2,scale=Math.min(availableW/image.width,availableH/image.height),drawW=image.width*scale,drawH=image.height*scale,x=(pageWidth-drawW)/2,y=(pageHeight-drawH)/2;
    const command='q\n'+drawW.toFixed(3)+' 0 0 '+drawH.toFixed(3)+' '+x.toFixed(3)+' '+y.toFixed(3)+' cm\n/Im'+index+' Do\nQ\n',commandBytes=pdfTextBytes(command);
    objects[pageObj]=pdfTextBytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+'] /Resources << /XObject << /Im'+index+' '+imageObj+' 0 R >> >> /Contents '+contentObj+' 0 R >>');
    objects[contentObj]=joinByteArrays([pdfTextBytes('<< /Length '+commandBytes.length+' >>\nstream\n'),commandBytes,pdfTextBytes('endstream')]);
    objects[imageObj]=joinByteArrays([pdfTextBytes('<< /Type /XObject /Subtype /Image /Width '+image.width+' /Height '+image.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+imageBytes.length+' >>\nstream\n'),imageBytes,pdfTextBytes('\nendstream')]);
  });
  objects[2]=pdfTextBytes('<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+images.length+' >>');
  const chunks=[new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10])],offsets=new Array(objectCount+1).fill(0);let length=chunks[0].length;
  for(let i=1;i<=objectCount;i++){offsets[i]=length;const chunk=joinByteArrays([pdfTextBytes(i+' 0 obj\n'),objects[i],pdfTextBytes('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;}
  const xrefOffset=length;let xref='xref\n0 '+(objectCount+1)+'\n0000000000 65535 f \n';for(let i=1;i<=objectCount;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  chunks.push(pdfTextBytes(xref+'trailer\n<< /Size '+(objectCount+1)+' /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF'));
  return new Blob(chunks,{type:'application/pdf'});
}
function downloadLocalBlob(blob,fileName){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function exportCapturePDF(){
  const entry=entries.find(e=>e.id===_captureEntryId);if(!entry||!_captureImages.length)return;
  const button=document.getElementById('captureExportBtn');button.disabled=true;button.textContent='กำลังสร้าง PDF…';setCaptureStatus('กำลังจัดหน้า PDF','busy');
  try{
    const fileName=buildOutputFileName(entry.date,entry.pub,entry.platform,getActiveProject());
    const pageW=595.28,pageH=841.89,margin=28,pages=[];
    if(document.getElementById('captureCover').checked)pages.push({dataUrl:captureCoverData(entry,_captureImages.length,fileName),width:1240,height:1754});
    for(let n=0;n<_captureImages.length;n++){
      setCaptureStatus('กำลังจัดภาพ '+(n+1)+'/'+_captureImages.length,'busy');const item=_captureImages[n],img=await loadImageSource(item.dataUrl);const slices=capturePageSlices(img.naturalWidth,img.naturalHeight,pageW,pageH,margin);
      for(const slice of slices){const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=slice.height;canvas.getContext('2d').drawImage(img,0,slice.y,img.naturalWidth,slice.height,0,0,img.naturalWidth,slice.height);pages.push({dataUrl:canvas.toDataURL('image/jpeg',.9),width:canvas.width,height:canvas.height});}
    }
    downloadLocalBlob(buildImagePDFBlob(pages,pageW,pageH,margin),fileName);
    const idx=entries.findIndex(e=>e.id===entry.id);entries[idx]={...entries[idx],status:entries[idx].status==='completed'?'completed':'ready',pdfGeneratedAt:new Date().toISOString(),fileName,updatedAt:new Date().toISOString()};saveProjEntries(_activeProj,entries);renderTable();setCaptureStatus('สร้าง '+fileName+' แล้ว','ok');toast('✓ ดาวน์โหลด PDF: '+fileName,'ok');
  }catch(err){setCaptureStatus('สร้าง PDF ไม่สำเร็จ: '+err.message,'err');}
  finally{button.disabled=false;button.textContent='สร้างและดาวน์โหลด PDF';}
}

// ═══ AUTOCOMPLETE ═══
let acI=[],acIdx=-1;
function onPubIn(){
  _validationEnabled = true;
  const q=(document.getElementById('fPub').value||'').trim().toLowerCase();
  const dd=document.getElementById('acDrop');
  if(!q){dd.classList.remove('open');upAuto();return;}
  const plat=document.getElementById('fPlat').value;

  // Match by pub name
  let res=matchDB(q).filter(d=>{
    const p=d._searchPub;
    return p.startsWith(q)||p.includes(q);
  });

  // Sort: exact-platform match first → startsWith → includes → alpha
  res.sort((a,b)=>{
    const ap=a.pub.toLowerCase(), bp=b.pub.toLowerCase();
    const aPlat=plat&&a.platform===plat, bPlat=plat&&b.platform===plat;
    if(aPlat!==bPlat)return aPlat?-1:1;
    const aStart=ap.startsWith(q), bStart=bp.startsWith(q);
    if(aStart!==bStart)return aStart?-1:1;
    return ap.localeCompare(bp);
  });

  // NO platform filter, NO dedup — show all matching keys across all platforms
  // Cap at 80 results
  acI=res.slice(0,80);acIdx=-1;

  if(!acI.length){
    dd.innerHTML='<div class="acr-empty">ไม่พบ — กรอกเองหรือเพิ่มใน Manual/DB</div>';
    dd.classList.add('open');return;
  }
  dd.innerHTML=acI.map((d,i)=>{
    const isCurrentPlat=plat&&d.platform===plat;
    return `<div class="acr${isCurrentPlat?' acr-match':''}" onmousedown="selPub(${i})">
      <span class="acr-pub">${hl(d.pub,q)}</span>
      <span class="acr-right">
        <span class="acr-pl" style="${isCurrentPlat?'background:rgba(5,150,105,.15);color:#065f46':''}">${d.platform}</span>
        <span class="acr-v">฿${d.value.toLocaleString()}</span>
      </span>
    </div>`;
  }).join('');
  dd.classList.add('open');
}
function hl(t,q){
  const safeText=esc(t),safeQuery=esc(q);
  return safeText.replace(new RegExp('('+safeQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>');
}
function onPubKey(e){
  const dd=document.getElementById('acDrop');
  if(!dd.classList.contains('open'))return;
  if(e.key==='ArrowDown'){acIdx=Math.min(acIdx+1,acI.length-1);document.querySelectorAll('.acr').forEach((el,i)=>el.classList.toggle('sel',i===acIdx));e.preventDefault();}
  else if(e.key==='ArrowUp'){acIdx=Math.max(acIdx-1,-1);document.querySelectorAll('.acr').forEach((el,i)=>el.classList.toggle('sel',i===acIdx));e.preventDefault();}
  else if(e.key==='Enter'&&acIdx>=0){selPub(acIdx);e.preventDefault();}
  else if(e.key==='Escape')dd.classList.remove('open');
}
function selPub(i){
  const d=acI[i];
  document.getElementById('fPub').value=d.pub;
  // Always set platform from selected entry (user chose this specific platform row)
  const fp=document.getElementById('fPlat');
  if(fp)fp.value=normPlatform(d.platform);
  _autoFilledPlat=false; // user explicitly chose this platform
  document.getElementById('acDrop').classList.remove('open');
  upAuto();
}
// (autocomplete/logo dropdown close merged into consolidated click handler above)

// ═══ LOGO MANUAL ═══
function onLogoManual(){
  const q=(document.getElementById('logoManual').value||'').trim();
  const dd=document.getElementById('logoSuggestions');
  if(!q){dd.classList.remove('open');upAuto();return;}
  const sugs=LOGO_FILES.filter(f=>f.toLowerCase().includes(q.toLowerCase())).slice(0,12);
  if(!sugs.length){dd.classList.remove('open');upAuto();return;}
  dd.innerHTML=sugs.map(f=>`<div class="logo-sug-row" data-logo-suggestion="${escAttr(f)}">${esc(f)}</div>`).join('');
  dd.classList.add('open');upAuto();
}
function setLogo(f){document.getElementById('logoManual').value=f;document.getElementById('logoSuggestions').classList.remove('open');upAuto();}

// ═══ MANUAL TOGGLE ═══

function togLogoEdit(){
  const wrap=document.getElementById('logoEditWrap');
  if(!wrap)return;
  const open=wrap.style.display==='block';
  wrap.style.display=open?'none':'block';
  if(!open){const inp=document.getElementById('logoManual');if(inp)inp.focus();}
}
function applyLogoEdit(){
  document.getElementById('logoEditWrap').style.display='none';
  document.getElementById('logoSuggestions').classList.remove('open');
  upAuto();
}
function togDetail(){
  const sec=document.getElementById('detailSec');
  const arr=document.getElementById('detailArr');
  const open=sec.style.display==='flex';
  sec.style.display=open?'none':'flex';
  if(arr)arr.textContent=open?'▼':'▲';
}
function togMan(){
  const s=document.getElementById('manSec'),b=document.getElementById('manTog');
  const o=s.classList.toggle('open');b.classList.toggle('open',o);
}

// ═══ AUTO UPDATE ═══

// Debounced upAuto for input events (avoids rapid recalc while typing)
const _upAutoDebounced = debounce(upAuto, 120);
window._upAutoDebounced = _upAutoDebounced;

function upAuto(){
  const pub=(document.getElementById('mPub').value||'').trim()||(document.getElementById('fPub').value||'').trim();
  const plat=(document.getElementById('mPlat').value||'').trim()||getEffPlat();
  const date=document.getElementById('fDate').value||'';
  const manPR=(document.getElementById('mPR').value||'').trim();
  const logoManual=(document.getElementById('logoManual').value||'').trim();
  const prEl=document.getElementById('prVal'),tEl=document.getElementById('prTier'),fnEl=document.getElementById('fnBox'),logoEl=document.getElementById('logoBox');
  if(!pub){
    prEl.textContent='— เลือกสื่อก่อน';prEl.className='pr-val empty';
    tEl.style.display='none';fnEl.textContent='—';fnEl.className='fauto empty';
    logoEl.textContent='—';logoEl.className='flogo empty';
    if(_validationEnabled)renderValidation();
    return;
  }
  // PR
  if(manPR&&!isNaN(Number(manPR))){
    prEl.textContent=fmtPR(Number(manPR))+' (manual)';prEl.className='pr-val';prEl.style.color='rgba(255,255,255,.85)';
    tEl.style.display='inline-block';tEl.textContent='MANUAL';
  }else{
    const f=lookupPR(pub,plat);
    if(f){
      prEl.textContent=fmtPR(f.value);prEl.className='pr-val';prEl.style.color='';
      tEl.style.display='inline-block';
      tEl.textContent=f.value>=360000?'🥇 GOLD':f.value>=210000?'🥈 SILVER':'🥉 BRONZE';
    }else{prEl.textContent='ไม่พบใน DB';prEl.className='pr-val empty';tEl.style.display='none';}
  }
  // File name
  const fn=buildFN(date,pub,plat);fnEl.textContent=fn||'—';fnEl.className=fn?'fauto':'fauto empty';
  // Auto-detect TYPE if not manually set
  const typeEl=document.getElementById('fType');
  if(typeEl&&!typeEl.dataset.manuallySet){
    const autoType={'Facebook':'Social Media','Instagram':'Social Media','TikTok':'Social Media','X':'Social Media','Lemon8':'Social Media','LINE':'Social Media','YouTube':'Video','TV':'TV','Website':'Online','MSN':'Online','LINE TODAY':'Online'}[plat]||'';
    if(autoType)typeEl.value=autoType;
  }
  // Logo
  if(logoManual){
    logoEl.innerHTML=esc(logoManual)+'<span class="conf conf-hi" style="margin-left:auto">manual</span>';
    logoEl.className='flogo';
  }else{
    const lr=findLogoFast(pub);
    if(lr.file){
      const pct=Math.round(lr.score*100);
      const cc=pct>=85?'conf-hi':pct>=70?'conf-mid':'conf-lo';
      logoEl.innerHTML='<span style="flex:1;word-break:break-all">'+esc(lr.file)+'</span><span class="conf '+cc+'">'+pct+'%</span>';
      logoEl.className='flogo';
    }else{logoEl.textContent='ไม่พบ — กรอกด้านล่าง';logoEl.className='flogo empty';}
  }
  if(_validationEnabled)renderValidation();
}

// ═══ ADD / EDIT ENTRY ═══
function addEntry(){
  const pub=(document.getElementById('mPub').value||'').trim()||(document.getElementById('fPub').value||'').trim();
  const plat=(document.getElementById('mPlat').value||'').trim()||getEffPlat();
  const date=document.getElementById('fDate').value||'';
  const url=(document.getElementById('mLink').value||'').trim()||(document.getElementById('fUrl').value||'').trim();
  const manPR=(document.getElementById('mPR').value||'').trim();
  const autoSave=document.getElementById('autoSaveDB').checked;
  // Simple required field check (no full validation needed here)
  if(!pub){toast('กรุณากรอกชื่อสื่อ','err');return;}
  if(!plat){toast('กรุณาเลือก Platform','err');return;}
  if(!date){toast('กรุณาเลือกวันที่','err');return;}
  if(url&&!safeHttpUrl(url)){toast('URL ต้องขึ้นต้นด้วย http:// หรือ https://','err');return;}
  // Show any warnings (URL dup etc.) via strip
  _validationEnabled = true;
  renderValidation();
  const exactDuplicate=url&&entries.find(e=>e.url&&normalizeUrl(e.url)===normalizeUrl(url));
  if(exactDuplicate&&!confirm('URL นี้มีอยู่แล้วใน '+exactDuplicate.pub+' ('+exactDuplicate.date+')\nต้องการเพิ่มซ้ำโดยเจตนาหรือไม่?')){
    highlightEntry(exactDuplicate.id);
    toast('ยังไม่ได้เพิ่ม — พบ URL ซ้ำ','err');
    return;
  }
  let prValue=null;
  if(manPR&&!isNaN(Number(manPR)))prValue=Number(manPR);
  else{const f=lookupPR(pub,plat);prValue=f?f.value:null;}
  const logoManual=(document.getElementById('logoManual').value||'').trim();
  const lr=logoManual?{file:logoManual}:findLogoFast(pub);
  const f=lookupPR(pub,plat);
  const newId=Date.now();
  const now=new Date().toISOString();
  entries.push({
    id:newId,date,url,pub,platform:plat,prValue,
    duration:plat==='TV'?(document.getElementById('fDuration').value||'').trim():'',
    fullKey:(f&&f.platform===plat)?f.key:makeDbKey(pub,plat),
    type:document.getElementById('fType').value||'',
    headline:(document.getElementById('fHead').value||'').trim(),
    remark:(document.getElementById('fRemark').value||'').trim(),
    fileName:buildFN(date,pub,plat),
    logoFile:lr.file||'',status:document.getElementById('fStatus').value||'draft',createdAt:now,updatedAt:now
  });
  const r=parseUrl(url);
  if(r._username&&pub)addUsernameMapping(r._username,plat,pub);
  if(url)addUrlToHistory(url,newId,pub,date);
  saveProjEntries(_activeProj, entries);
  updBadge();
  if(manPR&&!isNaN(Number(manPR))&&autoSave){saveToCustom(pub,plat,Number(manPR));renderRecent();toast('✓ เพิ่ม + บันทึก '+pub+' ลง DB','info');}
  else toast('✓ เพิ่ม: '+pub+' ('+plat+')','ok');
  renderTable();clearForm();
}
let _dupHighlightId = null; // currently highlighted dup row

function highlightEntry(id){
  _dupHighlightId = id;
  // Switch to entry view, scroll to row, flash it
  sv('entry');
  setTimeout(()=>{
    const rows = document.querySelectorAll('#tbody tr');
    // Clear any previous highlight
    rows.forEach(r => {
      r.classList.remove('dup-highlight');
      r.style.outline = '';
    });
    for(const row of rows){
      const btn = row.querySelector('.edit-btn');
      if(btn && btn.dataset.id == id){
        row.classList.add('dup-highlight');
        row.scrollIntoView({behavior:'smooth', block:'center'});
        // Pulse animation: flash 3 times
        let count = 0;
        const flash = () => {
          row.style.background = count%2===0 ? 'rgba(239,68,68,.12)' : '';
          count++;
          if(count < 6) setTimeout(flash, 350);
          else { row.style.background = 'rgba(239,68,68,.06)'; }
        };
        flash();
        break;
      }
    }
  }, 120);
}

function clearDupHighlight(){
  if(_dupHighlightId === null) return;
  const rows = document.querySelectorAll('#tbody tr');
  rows.forEach(r => {
    r.classList.remove('dup-highlight');
    r.style.background = '';
  });
  _dupHighlightId = null;
}
function dupEntry(id){
  const src=entries.find(e=>e.id===id);
  if(!src)return;
  const now=new Date().toISOString();
  const copy={...src,id:Date.now(),url:'',status:'draft',createdAt:now,updatedAt:now,fileName:buildFN(src.date,src.pub,src.platform)};
  entries.push(copy);
  saveProjEntries(_activeProj, entries);
  updBadge();renderTable();
  toast('⧉ Duplicate "'+esc(src.pub)+'" — แก้ Platform/URL ได้เลย','info');
}
function saveEdit(id){
  const pub=(document.getElementById('er_pub').value||'').trim();
  const plat=document.getElementById('er_plat').value||'Website';
  const date=document.getElementById('er_date').value||'';
  const url=(document.getElementById('er_url').value||'').trim();
  const prRaw=(document.getElementById('er_pr').value||'').trim();
  const logoFile=(document.getElementById('er_logo').value||'').trim();
  const type=(document.getElementById('er_type').value||'').trim();
  const duration=(document.getElementById('er_duration').value||'').trim();
  const status=(document.getElementById('er_status').value||'draft');
  if(!pub){toast('กรุณากรอกชื่อสื่อ','err');return;}
  if(url&&!safeHttpUrl(url)){toast('URL ต้องขึ้นต้นด้วย http:// หรือ https://','err');return;}
  const prValue=prRaw&&!isNaN(Number(prRaw))?Number(prRaw):(()=>{const f=lookupPR(pub,plat);return f?f.value:null;})();
  const f=lookupPR(pub,plat);
  const idx=entries.findIndex(e=>e.id===id);if(idx<0)return;
  entries[idx]={...entries[idx],pub,platform:plat,date,url,prValue,
    fullKey:(f&&f.platform===plat)?f.key:makeDbKey(pub,plat),
    fileName:buildFN(date,pub,plat),
    logoFile:logoFile||(()=>{const lr=findLogoFast(pub);return lr.file||'';})(),type,duration:plat==='TV'?duration:'',status,updatedAt:new Date().toISOString()};
  saveProjEntries(_activeProj, entries);
  editingRowId=null;updBadge();renderTable();toast('✓ บันทึก: '+pub,'ok');
}
function _resetFormFields(){
  ['fPub','fUrl','fHead','fRemark','mPub','mPlat','mPR','mLink','logoManual','fDuration']
    .forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const fp=document.getElementById('fPlat');if(fp)fp.value='';
  const dr=document.getElementById('durationRow');if(dr)dr.style.display='none';
  const ft=document.getElementById('fType');if(ft){ft.value='';ft.dataset.manuallySet='';}
  const fs=document.getElementById('fStatus');if(fs)fs.value='draft';
  document.getElementById('fDate').value=new Date().toISOString().slice(0,10);
}
function _resetFormUI(){
  document.getElementById('urlHint').classList.remove('show');
  document.getElementById('acDrop').classList.remove('open');
  document.getElementById('logoSuggestions').classList.remove('open');
  const lew=document.getElementById('logoEditWrap');if(lew)lew.style.display='none';
  const cp=document.getElementById('customPlatPanel');if(cp)cp.style.display='none';
  const ds=document.getElementById('detailSec');if(ds)ds.style.display='none';
  const da=document.getElementById('detailArr');if(da)da.textContent='▼';
}
function _resetFormState(){
  _autoFilledPub=false;_autoFilledPlat=false;_autoFilledDate=false;
  setDetected('','');
  clearValidation();
  hideDupBadge();
}
function clearForm(){
  _resetFormFields();
  _resetFormUI();
  _resetFormState();
  upAuto();
}
let _undoTimer=null,_undoEntry=null,_undoIdx=-1;
function delEntry(id){
  const idx=entries.findIndex(e=>e.id===id);
  if(idx<0)return;
  _undoEntry={...entries[idx]};_undoIdx=idx;
  if(_undoEntry.url)removeUrlFromHistory(_undoEntry.url);
  entries.splice(idx,1);
  saveProjEntries(_activeProj, entries);
  updBadge();renderTable();
  // Undo toast
  clearTimeout(_undoTimer);
  const t=document.getElementById('toast');
  t.innerHTML='ลบ "'+esc(_undoEntry.pub)+'" แล้ว &nbsp;<button onclick="undoDelete()" style="background:rgba(255,255,255,.2);border:none;color:inherit;padding:2px 8px;border-radius:4px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700">ยกเลิก</button>';
  t.className='toast info show';
  _undoTimer=setTimeout(()=>{t.classList.remove('show');t.innerHTML='';_undoEntry=null;},5000);
}
function undoDelete(){
  if(!_undoEntry)return;
  clearTimeout(_undoTimer);
  entries.splice(_undoIdx,0,_undoEntry);
  if(_undoEntry.url)addUrlToHistory(_undoEntry.url,_undoEntry.id,_undoEntry.pub,_undoEntry.date);
  saveProjEntries(_activeProj, entries);
  updBadge();renderTable();
  toast('✓ คืนค่า "'+_undoEntry.pub+'" แล้ว','ok');
  _undoEntry=null;
}
function clearAll(){if(!confirm('ลบรายการทั้งหมด?'))return;entries.length=0;saveProjEntries(_activeProj,[]);updBadge();renderTable();}

// ═══ TABLE ═══
function platCls(p){const m={'Facebook':'pt-fb','Instagram':'pt-ig','YouTube':'pt-yt','TikTok':'pt-tk','X':'pt-x','Website':'pt-ws','Web':'pt-web','TV':'pt-tv','LINE':'pt-line','LINE TODAY':'pt-line','Lemon8':'pt-l8','Threads':'pt-threads','MSN':'pt-msn'};return m[p]||'pt-def';}
function statusMeta(status){
  return{
    draft:{label:'Draft',cls:'ws-draft'},captured:{label:'Captured',cls:'ws-captured'},
    ready:{label:'Ready',cls:'ws-ready'},completed:{label:'Completed',cls:'ws-completed'}
  }[status]||{label:'Draft',cls:'ws-draft'};
}

// ─── Sort state ───
let _sortCol='date', _sortDir=-1; // default: newest first
function sortBy(col){
  if(_sortCol===col) _sortDir*=-1;
  else{_sortCol=col;_sortDir=col==='date'?-1:1;}
  renderTable();
}
function clearDateFilter(){
  const f=document.getElementById('filtFrom'),t=document.getElementById('filtTo');
  if(f)f.value='';if(t)t.value='';
  const b=document.getElementById('btnClearDate');if(b)b.style.display='none';
  renderTable();
}

function renderTable(){
  const q=(document.getElementById('srch').value||'').toLowerCase();
  const fp=document.getElementById('filt').value||'';
  const fs=(document.getElementById('filtStatus')||{}).value||'';
  const fromV=(document.getElementById('filtFrom')||{}).value||'';
  const toV=(document.getElementById('filtTo')||{}).value||'';
  // Show/hide clear date button
  const btnCD=document.getElementById('btnClearDate');
  if(btnCD)btnCD.style.display=(fromV||toV)?'inline-block':'none';
  // Filter: search covers pub, url, headline, remark, type
  const filt=entries.filter(e=>{
    if(q&&!( e.pub.toLowerCase().includes(q)||(e.url||'').toLowerCase().includes(q)
            ||(e.headline||'').toLowerCase().includes(q)||(e.remark||'').toLowerCase().includes(q)
            ||(e.type||'').toLowerCase().includes(q) ))return false;
    if(fp&&e.platform!==fp)return false;
    if(fs&&(e.status||'draft')!==fs)return false;
    if(fromV&&e.date&&e.date<fromV)return false;
    if(toV&&e.date&&e.date>toV)return false;
    return true;
  });
  // Sort
  filt.sort((a,b)=>{
    let av=a[_sortCol],bv=b[_sortCol];
    if(_sortCol==='prValue'){av=av||0;bv=bv||0;return _sortDir*(av-bv);}
    return _sortDir*String(av||'').localeCompare(String(bv||''));
  });
  // Update sort indicators on headers
  ['date','pub','platform','prValue'].forEach(col=>{
    const siMap={date:'si_date',pub:'si_pub',platform:'si_plat',prValue:'si_pr'};
    const el=document.getElementById(siMap[col]);
    if(!el)return;
    el.textContent=col===_sortCol?(_sortDir>0?'▲':'▼'):'';
    el.style.opacity=col===_sortCol?'1':'0.4';
  });
  document.getElementById('cntLbl').textContent=filt.length+' รายการ';
  const tb=document.getElementById('tbody');

  // [BUG FIX] Apply column visibility to table headers (was only hiding headers, not data cells)
  const _colTHMap={'thFn':'col_fn','thLogo':'col_logo','thType':'col_type','thStatus':'col_status'};
  Object.entries(_colTHMap).forEach(([thId,cbId])=>{
    const th=document.getElementById(thId);
    if(th)th.style.display=colVis(cbId)?'':'none';
  });

  if(!filt.length){
    const hasEntries=entries.length>0;
    tb.innerHTML='<tr><td colspan="10" style="text-align:center;padding:56px;color:var(--text3)">'
      +'<div style="font-size:28px;margin-bottom:8px">'+(hasEntries?'🔍':'📋')+'</div>'
      +'<div style="font-weight:700">'+(hasEntries?'ไม่พบรายการที่ค้นหา':'ยังไม่มีรายการ')+'</div>'
      +'<div style="font-size:12px;margin-top:4px">'+(hasEntries?'ลองเปลี่ยน filter หรือคำค้นหา':'วาง URL ในช่องซ้าย แล้วกด "เพิ่มรายการ"')+'</div>'
      +(hasEntries?'':'<div style="margin-top:10px;font-size:11px;color:var(--text3)">💡 กด Enter เพื่อเพิ่มรายการเร็วขึ้น</div>')
      +'</td></tr>';return;}
  tb.innerHTML=filt.map(e=>{
    if(editingRowId===e.id){
      return '<tr style="background:#f5f3ff;border-bottom:2px solid var(--accent)">'
        +'<td class="batch-select-col"></td>'
        +'<td><input class="erinp" id="er_date" type="date" value="'+escAttr(e.date||'')+'" style="width:130px"></td>'
        +'<td><input class="erinp" id="er_pub" value="'+escAttr(e.pub||'')+'" style="margin-bottom:4px"><input class="erinp" id="er_url" value="'+escAttr(e.url||'')+'" style="font-size:11px"></td>'
        +'<td><select class="ersel" id="er_plat">'+platformOptions(e.platform,true)+'</select></td>'
        +'<td><input class="erinp" id="er_pr" type="number" value="'+(e.prValue||'')+'" style="width:110px;text-align:right"></td>'
        +'<td colspan="2"><input class="erinp" id="er_logo" value="'+escAttr(e.logoFile||'')+'" style="font-size:11px;margin-bottom:4px"><input class="erinp" id="er_type" value="'+escAttr(e.type||'')+'" style="font-size:11px;margin-bottom:4px"><input class="erinp" id="er_duration" value="'+escAttr(e.duration||'')+'" placeholder="Duration (TV)" style="font-size:11px"></td>'
        +'<td><select class="ersel" id="er_status">'+WORK_STATUSES.map(s=>'<option value="'+s+'"'+(s===(e.status||'draft')?' selected':'')+'>'+statusMeta(s).label+'</option>').join('')+'</select></td>'
        +'<td style="white-space:nowrap;vertical-align:middle">'
        +'<button class="save-row-btn" onclick="saveEdit('+e.id+')">✓ บันทึก</button> '
        +'<button class="cancel-row-btn" onclick="editingRowId=null;renderTable()">ยกเลิก</button></td></tr>';
    }
    const prC=e.prValue?(e.prValue>=360000?'color:var(--green)':e.prValue>=210000?'color:var(--accent)':''):'color:var(--text3)';
    const workStatus=statusMeta(e.status||'draft');
    const dataWarning=!e.prValue?'ไม่พบ PR':(!e.date||!e.pub||!e.platform)?'ข้อมูลไม่ครบ':'';
    const urlS=e.url?e.url.replace(/https?:\/\//,'').slice(0,28)+'…':'—';
    const fnChip=e.fileName?'<span class="fn-chip">📄 '+esc(e.fileName)+'</span>':'<span style="color:var(--text3);font-size:11px">—</span>';
    // [BUG FIX] Conditionally render optional columns based on checkbox state
    return '<tr data-entry-id="'+e.id+'">'
      +'<td class="batch-select-col"><input class="batch-row-check" type="checkbox" value="'+e.id+'" onchange="toggleBatchRow('+e.id+',this.checked)" aria-label="เลือก '+escAttr(e.pub)+'"></td>'
      +'<td class="td-mono">'+esc(e.date||'—')+'</td>'
      +'<td><div class="td-pub">'+esc(e.pub)+'</div>'
        +(colVis('col_url')&&safeHttpUrl(e.url)?'<div style="margin-top:2px"><a href="'+escAttr(safeHttpUrl(e.url))+'" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:var(--accent);text-decoration:none;opacity:.8">'+esc(urlS)+'</a></div>':'')
      +'</td>'
      +'<td><span class="pt '+platCls(e.platform)+'">'+esc(e.platform)+'</span></td>'
      +'<td style="font-family:var(--mono);font-weight:800;font-size:14px;'+prC+';text-align:right;white-space:nowrap">'+(e.prValue?fmtPR(e.prValue):'—')+'</td>'
      +(colVis('col_fn')?'<td>'+fnChip+'</td>':'')
      +(colVis('col_logo')?'<td class="td-logo">'+esc(e.logoFile||'—')+'</td>':'')
      +(colVis('col_type')?'<td style="font-size:11px;color:var(--text2)">'+esc(e.type||'—')+'</td>':'')
      +(colVis('col_status')?'<td><span class="work-status '+workStatus.cls+'">'+workStatus.label+'</span>'+(dataWarning?'<div style="font-size:9px;color:var(--red);margin-top:3px">⚠ '+dataWarning+'</div>':'')+'</td>':'')
      +'<td style="white-space:nowrap">'
      +'<button class="sbtn capture-btn" onclick="openCapture('+e.id+')" title="เก็บภาพและสร้าง PDF">📸 '+(e.captureCount||'Capture')+'</button> '
      +'<button class="sbtn edit-btn" onclick="editingRowId='+e.id+';renderTable()">✏ แก้</button> '
      +'<button class="sbtn" onclick="dupEntry('+e.id+')" title="Duplicate entry" style="font-size:11px">⧉</button> '
      +'<button class="sbtn del" onclick="delEntry('+e.id+')">ลบ</button></td></tr>';
  }).join('');
  const total=entries.reduce((s,e)=>s+(e.prValue||0),0);
  const MAIN_PLATS=['Facebook','Instagram','Web','Website','YouTube','TV','TikTok','X','LINE TODAY','LINE'];
  document.getElementById('sCount').textContent=entries.length;
  document.getElementById('sPR').textContent=fmtPR(total);
  document.getElementById('sFB').textContent=entries.filter(e=>e.platform==='Facebook').length;
  document.getElementById('sIG').textContent=entries.filter(e=>e.platform==='Instagram').length;
  document.getElementById('sWeb').textContent=entries.filter(e=>['Web','Website'].includes(e.platform)).length;
  document.getElementById('sVid').textContent=entries.filter(e=>['YouTube','TV'].includes(e.platform)).length;
  const sOther=document.getElementById('sOther');
  if(sOther)sOther.textContent=entries.filter(e=>!MAIN_PLATS.includes(e.platform)).length;
  document.getElementById('sWarn').textContent=entries.filter(e=>!e.prValue).length;
}
function updBadge(){
  const total=entries.reduce((s,e)=>s+(e.prValue||0),0);
  document.getElementById('topBadge').textContent=entries.length+' รายการ | '+fmtPR(total);
}

// ═══ EXPORT ═══

// ─── Column toggle ───
function togColMenu(){
  const m=document.getElementById('colMenu');
  if(m)m.style.display=m.style.display==='block'?'none':'block';
}
function colVis(id){const el=document.getElementById(id);return el?el.checked:true;}
// (colMenu close merged into consolidated click handler above)

// ─── Export modal ───
function showExportModal(){
  const modal=document.getElementById('exportModal');
  if(!modal)return;
  modal.style.display='flex';
  // Pre-fill dates
  const dates=entries.map(e=>e.date).filter(Boolean).sort();
  if(dates.length){
    const fromEl=document.getElementById('expFrom');
    const toEl=document.getElementById('expTo');
    if(fromEl)fromEl.value=dates[0];
    if(toEl)toEl.value=dates[dates.length-1];
  }
  // Sync registry platforms into expPlat, then retain inactive platforms used by entries
  syncPlatOptions();
  const expPlatSel=document.getElementById('expPlat');
  if(expPlatSel){
    const activePlats=[...new Set(entries.map(e=>e.platform).filter(Boolean))].sort();
    const existing=new Set([...expPlatSel.options].map(o=>o.value));
    activePlats.filter(p=>!existing.has(p)).forEach(p=>{
      const opt=document.createElement('option');opt.value=p;opt.textContent=p;opt.dataset.custom='1';
      expPlatSel.appendChild(opt);
    });
  }
  updateExpCount();
}
function closeExportModal(){
  const modal=document.getElementById('exportModal');
  if(modal)modal.style.display='none';
}
function updateExpCount(){
  const from=(document.getElementById('expFrom').value||'');
  const to=(document.getElementById('expTo').value||'');
  const plat=(document.getElementById('expPlat').value||'');
  const filtered=getExportEntries(from,to,plat);
  const el=document.getElementById('expCount');
  if(el)el.textContent='จะ export '+filtered.length+' รายการ / '+entries.length+' ทั้งหมด';
}
function getExportEntries(from,to,plat){
  return entries.filter(e=>{
    if(from&&e.date&&e.date<from)return false;
    if(to&&e.date&&e.date>to)return false;
    if(plat&&e.platform!==plat)return false;
    return true;
  });
}
document.addEventListener('change',function(e){
  if(['expFrom','expTo','expPlat'].includes(e.target.id))updateExpCount();
});
function doExport(){
  const from=(document.getElementById('expFrom').value||'');
  const to=(document.getElementById('expTo').value||'');
  const plat=(document.getElementById('expPlat').value||'');
  const filtered=getExportEntries(from,to,plat);
  if(!filtered.length){toast('ไม่มีข้อมูลในช่วงที่เลือก','err');return;}
  closeExportModal();
  exportExcelData(filtered);
}

function exportExcel(){showExportModal();}
function styleSheetHeader(ws,headers){
  const border={style:'thin',color:{rgb:'D9DDEB'}};
  headers.forEach((_,index)=>{
    const ref=XLSX.utils.encode_cell({r:0,c:index});
    if(!ws[ref])return;
    ws[ref].s={
      font:{bold:true,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'4F46E5'}},
      alignment:{vertical:'center',wrapText:true},border:{bottom:border}
    };
  });
  ws['!rows']=ws['!rows']||[];ws['!rows'][0]={hpt:25};
  ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
}
function exportExcelData(data){
  if(!data||!data.length){toast('ไม่มีข้อมูล','err');return;}
  if(!ensureXLSX())return;
  const entries=data;
  const wb=XLSX.utils.book_new();
  const sorted=[...entries].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const project=getActiveProject();
  const projectName=project.clientName||project.name||'Default';
  const excelDate=value=>value?new Date(value+'T00:00:00'):'';

  // ── Sheet 1: News Data (full data, headers ภาษาไทย) ──
  const hdrs=['Project','วันที่','URL','ชื่อสื่อ','Platform','Logo_File','Full_Key','PR_Value','ประเภท','Headline','PDF_FileName','หมายเหตุ','Work_Status','Data_Status','Created_At','Updated_At'];
  const rows=sorted.map(e=>({
    'Project':projectName,'วันที่':excelDate(e.date),'URL':e.url||'','ชื่อสื่อ':e.pub||'','Platform':e.platform||'',
    'Logo_File':e.logoFile||'','Full_Key':e.fullKey||'','PR_Value':e.prValue||0,
    'ประเภท':e.type||'','Headline':e.headline||'','PDF_FileName':buildOutputFileName(e.date,e.pub,e.platform,project),'หมายเหตุ':e.remark||'',
    'Work_Status':statusMeta(e.status).label,
    'Data_Status':!e.prValue?'ไม่พบ DB':(!e.date||!e.pub||!e.platform)?'กรอกไม่ครบ':'พร้อม',
    'Created_At':e.createdAt||'','Updated_At':e.updatedAt||''
  }));
  const ws=XLSX.utils.json_to_sheet(rows,{header:hdrs});
  ws['!cols']=[{wch:18},{wch:12},{wch:44},{wch:28},{wch:14},{wch:26},{wch:32},{wch:14},{wch:12},{wch:36},{wch:34},{wch:22},{wch:14},{wch:12},{wch:22},{wch:22}];
  ws['!autofilter']={ref:'A1:P'+(rows.length+1)};
  rows.forEach((_,i)=>{
    const dateCell=ws['B'+(i+2)];if(dateCell)dateCell.z='dd/mm/yyyy';
    const prCell=ws['H'+(i+2)];if(prCell)prCell.z='#,##0';
  });
  styleSheetHeader(ws,hdrs);
  XLSX.utils.book_append_sheet(wb,ws,'News Data');

  // ── Sheet 2: MailMerge (เฉพาะ field ที่ใช้ใน Word) ──
  // Field names: สั้น ไม่มีช่องว่าง ใช้กับ «field» ใน Word ได้เลย
  const mmHdrs=['Project','Publication','PR_Value','Date','Link','Publication_Logo','Platform','Type','Headline','PDF_FileName','Remark','Work_Status'];
  const mmRows=sorted.map(e=>({
    'Project':projectName,'Publication':e.pub||'','PR_Value':e.prValue||0,'Date':excelDate(e.date),'Link':e.url||'',
    'Publication_Logo':e.logoFile||'','Platform':e.platform||'','Type':e.type||'','Headline':e.headline||'',
    'PDF_FileName':buildOutputFileName(e.date,e.pub,e.platform,project),'Remark':e.remark||'','Work_Status':statusMeta(e.status).label
  }));
  const wsMM=XLSX.utils.json_to_sheet(mmRows,{header:mmHdrs});
  wsMM['!cols']=[{wch:18},{wch:28},{wch:14},{wch:12},{wch:44},{wch:26},{wch:14},{wch:12},{wch:36},{wch:34},{wch:22},{wch:14}];
  wsMM['!autofilter']={ref:'A1:L'+(mmRows.length+1)};
  mmRows.forEach((_,i)=>{
    const dateCell=wsMM['D'+(i+2)];if(dateCell)dateCell.z='dd/mm/yyyy';
    const prCell=wsMM['C'+(i+2)];if(prCell)prCell.z='#,##0';
  });
  styleSheetHeader(wsMM,mmHdrs);
  XLSX.utils.book_append_sheet(wb,wsMM,'MailMerge');

  // ── Sheet 3: Summary ──
  const plats=[...new Set([...activePlatforms().map(p=>p.name),...entries.map(e=>e.platform).filter(Boolean)])];
  const totalPR=entries.reduce((s,e)=>s+(e.prValue||0),0);
  const ws3=XLSX.utils.aoa_to_sheet([
    ['สรุปภาพรวม',projectName,''],
    ['Total PR',totalPR,''],['จำนวนข่าว',entries.length,''],['','', ''],
    ['Platform','จำนวน','PR Value'],
    ...plats.map(p=>[p,entries.filter(e=>e.platform===p).length,entries.filter(e=>e.platform===p).reduce((s,e)=>s+(e.prValue||0),0)]),
    ['','',''],['Work Status','จำนวน',''],
    ...WORK_STATUSES.map(s=>[statusMeta(s).label,entries.filter(e=>(e.status||'draft')===s).length,''])
  ]);
  ws3['!cols']=[{wch:16},{wch:12},{wch:16}];
  styleSheetHeader(ws3,['สรุปภาพรวม','Project','']);
  ['B2','C6','C7','C8','C9','C10','C11','C12','C13','C14'].forEach(ref=>{if(ws3[ref])ws3[ref].z='#,##0';});
  XLSX.utils.book_append_sheet(wb,ws3,'Summary');

  const d=new Date();
  const _pname=filenamePart(projectName).slice(0,30);
  XLSX.writeFile(wb,String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'_'+_pname+'.xlsx',{cellStyles:true});
  toast('✓ Export สำเร็จ (3 sheets: News Data, MailMerge, Summary)','ok');
}

// ═══ QUICK DB ═══
function saveToCustom(pub,plat,val){
  plat=normPlatform(plat);const key=makeDbKey(pub,plat);
  const c=getCustom();const ex=c.findIndex(e=>e.key.toLowerCase()===key.toLowerCase());
  const entry={key,pub,platform:plat,value:val};
  if(ex>=0)c[ex]=entry;else c.push(entry);
  saveCustom(c);rebuildDB();
}
function qAdd(){
  const pub=(document.getElementById('qPub').value||'').trim();
  const plat=document.getElementById('qPlat').value||'Website';
  const val=parseInt((document.getElementById('qVal').value||'').replace(/,/g,''));
  if(!pub||isNaN(val)||val<=0){toast('กรอกชื่อสื่อและ PR Value','err');return;}
  saveToCustom(pub,plat,val);
  document.getElementById('qPub').value='';document.getElementById('qVal').value='';
  renderRecent();toast('✓ เพิ่ม '+pub,'ok');
  syncDBToSheets();
}
function renderRecent(){
  const c=[...getCustom(),...getImported()].slice(-8).reverse();
  const el=document.getElementById('dbRecent');
  if(!c.length){el.innerHTML='<div class="rec-empty">ยังไม่มี</div>';return;}
  el.innerHTML='';
  c.forEach(d=>{
    const isC=getCustom().some(e=>e.key===d.key);
    const div=document.createElement('div');
    div.className='rec-item';
    div.innerHTML='<div style="flex:1;min-width:0"><div class="rec-pub">'+esc(d.pub)+'</div>'
      +'<div style="display:flex;gap:3px;margin-top:2px"><span class="pt '+platCls(d.platform)+'" style="font-size:9px">'+esc(d.platform)+'</span>'
      +'<span class="rec-src '+(isC?'src-m':'src-i')+'">'+(isC?'manual':'import')+'</span></div></div>'
      +'<span class="rec-val">\u0e3f'+d.value.toLocaleString()+'</span>'
      +'<button class="rec-del" title="ลบ">\u2715</button>';
    const btn=div.querySelector('.rec-del');
    const k=d.key;
    btn.addEventListener('click',()=>delCustom(k));
    el.appendChild(div);
  });
}
function delCustom(key){
  saveCustom(getCustom().filter(e=>e.key!==key));
  saveImported(getImported().filter(e=>e.key!==key));
  rebuildDB();renderRecent();toast('ลบแล้ว','ok');
}

// ═══ DB MANAGER ═══
function renderDB(){
  const q=(document.getElementById('dbSrch').value||'').toLowerCase();
  const fp=document.getElementById('dbFPl').value||'';
  const src=document.getElementById('dbSrc').value||'';
  const d=matchDB(q,fp,src);
  document.getElementById('dbCnt').textContent=d.length.toLocaleString()+' รายการ';
  const dbBody=document.getElementById('dbBody');
  dbBody.innerHTML='';
  d.slice(0,400).forEach(e=>{
    const sl={'builtin':'Built-in','custom':'เพิ่มเอง','imported':'Import'}[e._src]||'—';
    const sc={'builtin':'src-builtin','custom':'src-custom','imported':'src-imported'}[e._src]||'';
    const ce=e._src!=='builtin';
    const prC=e.value>=360000?'color:var(--green)':e.value>=210000?'color:var(--accent)':'';
    const tr=document.createElement('tr');
    if(editingKey===e.key.toLowerCase()){
      tr.style.background='#fffbeb';
      tr.innerHTML='<td><input class="einp" id="ei_pub" value="'+esc(e.pub)+'"></td>'
        +'<td><select class="esel" id="ei_plat">'+platformOptions(e.platform,true)+'</select></td>'
        +'<td><input class="einp" id="ei_val" type="number" value="'+e.value+'" style="text-align:right"></td>'
        +'<td><span class="src-tag '+sc+'">'+sl+'</span></td>'
        +'<td style="white-space:nowrap">'
        +'<button class="save-btn">บันทึก</button> '
        +'<button class="cancel-btn">ยกเลิก</button></td>';
      tr.querySelector('.save-btn').addEventListener('click',()=>dbSaveEdit(e.key,e._src));
      tr.querySelector('.cancel-btn').addEventListener('click',()=>{editingKey=null;renderDB();});
    } else {
      tr.innerHTML='<td style="font-weight:600">'+esc(e.pub)+'</td>'
        +'<td><span class="pt '+platCls(e.platform)+'" style="font-size:10px">'+esc(e.platform)+'</span></td>'
        +'<td style="text-align:right;font-family:var(--mono);font-weight:700;'+prC+'">'+fmtPR(e.value)+'</td>'
        +'<td><span class="src-tag '+sc+'">'+sl+'</span></td>'
        +'<td style="white-space:nowrap">'
        +(ce
          ?'<button class="sbtn">✏ แก้</button> <button class="sbtn del">ลบ</button>'
          :'<button class="sbtn">✏ Override</button>')+'</td>';
      if(ce){
        tr.querySelectorAll('.sbtn')[0].addEventListener('click',()=>{editingKey=e.key.toLowerCase();renderDB();});
        tr.querySelectorAll('.sbtn')[1].addEventListener('click',()=>dbDel(e.key,e._src));
      } else {
        tr.querySelector('.sbtn').addEventListener('click',()=>overrideB(e.pub,e.platform,e.value));
      }
    }
    dbBody.appendChild(tr);
  });
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function escAttr(s){return esc(s).replace(/`/g,'&#96;');}
function safeHttpUrl(value){
  try{const u=new URL(String(value||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:'';}
  catch{return '';}
}
function dbSaveEdit(oldKey,src){
  const pub=(document.getElementById('ei_pub').value||'').trim();
  const plat=document.getElementById('ei_plat').value;
  const val=parseInt(document.getElementById('ei_val').value);
  if(!pub||isNaN(val)||val<=0){toast('กรอกให้ครบ','err');return;}
  const newKey=makeDbKey(pub,plat);
  const entry={key:newKey,pub,platform:plat,value:val};
  if(src==='custom'){const c=getCustom().filter(e=>e.key.toLowerCase()!==oldKey.toLowerCase());c.push(entry);saveCustom(c);}
  else{const imp=getImported().filter(e=>e.key.toLowerCase()!==oldKey.toLowerCase());imp.push(entry);saveImported(imp);}
  rebuildDB();editingKey=null;renderDB();renderRecent();toast('✓ บันทึก: '+pub,'ok');
}
function dbDel(key,src){
  if(!confirm('ลบ "'+key+'"?'))return;
  if(src==='custom')saveCustom(getCustom().filter(e=>e.key.toLowerCase()!==key.toLowerCase()));
  else saveImported(getImported().filter(e=>e.key.toLowerCase()!==key.toLowerCase()));
  rebuildDB();renderDB();renderRecent();toast('ลบแล้ว','ok');
}
function dbAdd(){
  const pub=(document.getElementById('dbPub').value||'').trim();
  const plat=document.getElementById('dbPlat').value||'Website';
  const val=parseInt((document.getElementById('dbVal').value||'').replace(/,/g,''));
  if(!pub||isNaN(val)||val<=0){toast('กรอกให้ครบ','err');return;}
  saveToCustom(pub,plat,val);
  document.getElementById('dbPub').value='';document.getElementById('dbVal').value='';
  renderDB();renderRecent();toast('✓ เพิ่ม '+pub,'ok');
  syncDBToSheets();
}
function overrideB(pub,plat,val){
  document.getElementById('dbPub').value=pub;document.getElementById('dbPlat').value=plat;document.getElementById('dbVal').value=val;
  toast('โหลดมาแล้ว — แก้ค่าแล้วกด "+ เพิ่ม"','info');
}
function exportCustomCSV(){
  const all=[...getCustom(),...getImported()];
  if(!all.length){toast('ไม่มี custom entry','err');return;}
  const rows=all.map(d=>[d.pub,d.platform,d.value,d.key].map(v=>'"'+String(v).replace(/"/g,'""')+'"'));
  const csv=['"Publication","Platform","PR Value","Full Key"',...rows.map(r=>r.join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download='CustomDB.csv';a.click();
}

// ═══ IMPORT ═══
const izEl=document.getElementById('iz');
izEl.addEventListener('dragover',e=>{e.preventDefault();izEl.classList.add('drag');});
izEl.addEventListener('dragleave',()=>izEl.classList.remove('drag'));
izEl.addEventListener('drop',e=>{e.preventDefault();izEl.classList.remove('drag');const f=e.dataTransfer.files[0];if(f)parseImport(f);});
function importFile(ev){const f=ev.target.files[0];if(f)parseImport(f);ev.target.value='';}
function findCol(hdrs,...cands){for(const h of hdrs){const hl=h.toLowerCase().replace(/[\s_\-]/g,'');for(const c of cands)if(hl.includes(c.toLowerCase().replace(/[\s_\-]/g,'')))return h;}return null;}
function normPlat(s){return normPlatform(s||'Website');}
function parseImport(file){
  if(!ensureXLSX())return;
  const res=document.getElementById('ires');res.style.display='none';
  const reader=new FileReader();
  reader.onload=ev=>{try{
    const data=new Uint8Array(ev.target.result);
    const wb=XLSX.read(data,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    if(!rows.length){showRes('err','ไม่พบข้อมูล');return;}
    const hdrs=Object.keys(rows[0]);
    const cP=findCol(hdrs,'publication','pub','media','สื่อ','ชื่อสื่อ','name');
    const cPl=findCol(hdrs,'platform','แพลต','plat');
    const cV=findCol(hdrs,'prvalue','pr value','pr_value','value','มูลค่า','ราคา');
    if(!cP||!cV){showRes('err','ไม่พบคอลัมน์\nต้องมี: Publication + PR Value\nพบ: '+hdrs.join(', '));return;}
    let added=0,updated=0,skipped=0;
    const imp=getImported();const imap={};imp.forEach(d=>{imap[d.key.toLowerCase()]=d;});
    rows.forEach(row=>{
      const pub=String(row[cP]||'').trim();const plat=normPlat(cPl?String(row[cPl]||'').trim():'');
      const val=parseInt(String(row[cV]||'').replace(/[,\s฿]/g,''));
      if(!pub||isNaN(val)||val<=0){skipped++;return;}
      const key=makeDbKey(pub,plat);
      if(imap[key.toLowerCase()])updated++;else added++;
      imap[key.toLowerCase()]={key,pub,platform:plat,value:val};
    });
    saveImported(Object.values(imap));rebuildDB();renderDB();renderRecent();
    showRes('ok','✓ "'+file.name+'"\nเพิ่ม '+added+' · อัปเดต '+updated+(skipped?' · ข้าม '+skipped:'')+'\nDB รวม '+DB.length.toLocaleString()+' รายการ');
    toast('นำเข้า '+(added+updated)+' รายการ','ok');
  }catch(err){showRes('err','ข้อผิดพลาด: '+err.message);}};
  reader.readAsArrayBuffer(file);
}
function showRes(type,msg){const el=document.getElementById('ires');el.className='ires '+type;el.style.display='block';el.textContent=msg;}

// ═══ USERNAME MAP ═══
let umapOpen=false;
function togUmap(){
  umapOpen=!umapOpen;
  document.getElementById('umapBody').classList.toggle('open',umapOpen);
  document.getElementById('umapArrow').textContent=umapOpen?'▲ ซ่อน':'▼ ดู/จัดการ';
  if(umapOpen)renderUmap();
}
function renderUmap(){
  const mappings=getUsernameMappings();
  const cnt=document.getElementById('umapCount');
  const empty=document.getElementById('umapEmpty');
  const rows=document.getElementById('umapRows');
  if(cnt)cnt.textContent=mappings.length?mappings.length+' รายการ':'';
  if(!mappings.length){if(empty)empty.style.display='block';if(rows)rows.innerHTML='';return;}
  if(empty)empty.style.display='none';
  if(rows)rows.innerHTML=mappings.sort((a,b)=>a.platform.localeCompare(b.platform)).map(m=>'<tr style="border-bottom:1px solid var(--bdr2)">'
    +'<td style="padding:6px 8px;font-family:var(--mono);font-size:11px;color:var(--accent)">@'+esc(m.username)+'</td>'
    +'<td style="padding:6px 8px"><span class="pt '+platCls(m.platform)+'" style="font-size:10px">'+esc(m.platform)+'</span></td>'
    +'<td style="padding:6px 8px;font-weight:600">'+esc(m.pub)+'</td>'
    +'<td style="padding:6px 8px;text-align:right"><button class="sbtn del umap-del-btn" data-username="'+escAttr(m.username)+'" data-plat="'+escAttr(m.platform)+'">ลบ</button></td></tr>').join('');
}
function umAdd(){
  const username=(document.getElementById('umUsername').value||'').trim().replace(/^@/,'');
  const plat=document.getElementById('umPlat').value;
  const pub=(document.getElementById('umPub').value||'').trim();
  if(!username||!pub){toast('กรอก username และชื่อสื่อ','err');return;}
  addUsernameMapping(username,plat,pub);
  document.getElementById('umUsername').value='';document.getElementById('umPub').value='';
  renderUmap();updUmapCount();toast('✓ จำ @'+username+' → '+pub,'ok');
}
function delUmap(username,platform){
  if(!confirm('ลบ @'+username+'?'))return;
  delUsernameMapping(username,platform);renderUmap();updUmapCount();toast('ลบแล้ว','ok');
}
function updUmapCount(){
  const cnt=document.getElementById('umapCount');
  if(cnt){const n=getUsernameMappings().length;cnt.textContent=n?n+' รายการ':'';}
}

// ═══ TAB ═══
function sv(tab){
  document.getElementById('vEntry').style.display=tab==='entry'?'':'none';
  document.getElementById('vDb').style.display=tab==='db'?'':'none';
  document.querySelectorAll('.tbtab').forEach((t,i)=>t.classList.toggle('on',['entry','db'][i]===tab));
  if(tab==='db'){editingKey=null;renderDB();updUmapCount();}
}

// ═══ TOAST ═══
function toast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'ok')+' show';clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3000);}
// (umap-del-btn delegation merged into consolidated click handler above; all other table/DB buttons use inline onclick)



// ── INIT: wrap in DOMContentLoaded so DOM is ready ──
document.addEventListener('DOMContentLoaded', function(){
  try{
    const legacySecret=safeLS.getItem('ck_gs_secret');
    if(legacySecret&&!safeSession.getItem('ck_gs_secret'))safeSession.setItem('ck_gs_secret',legacySecret);
    safeLS.removeItem('ck_gs_secret');
    migrateStorage();
    rebuildDB();
    const availableProjects=getAllProjects();
    if(!availableProjects.some(p=>p.id===_activeProj)){
      _activeProj=DEFAULT_PROJ;safeLS.setItem('ck_active_proj',_activeProj);
    }
    // Load active project entries
    const _initEntries = getProjEntries(_activeProj);
    _initEntries.forEach(e => entries.push(e));
    updProjBtn();
    updSyncBtn();
    syncPlatOptions();
    renderCustomPlatChips();
    // rebuildUrlHistory removed from init to prevent false dup warnings
    const dateEl = document.getElementById('fDate');
    if(dateEl) dateEl.value = new Date().toISOString().slice(0,10);
    const filePattern=document.getElementById('cfgFilePattern');if(filePattern)filePattern.addEventListener('input',updateFilePatternPreview);
    const projectName=document.getElementById('cfgProjectName');if(projectName)projectName.addEventListener('input',updateFilePatternPreview);
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      closeSettings();closeExportModal();closePlatformManager();closeCapture();closeProjDD();
    });
    renderTable();
    renderRecent();
    updBadge();
    updUmapCount();
  } catch(e){
    console.error('[ClipKit] Init error:', e);
  }
});
