const DATA_BASE='data/';
const state={category:'',level:'both',language:'',questions:[],categories:[],languages:[],translations:{},queue:[],queueTotal:0,history:[],index:-1,showTranslation:false,showAnswers:false};
const $=s=>document.querySelector(s);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const palettes=[
  {background:'#dceeff',border:'#4a90e2'},
  {background:'#fff2b8',border:'#c99a00'},
  {background:'#eadfff',border:'#8a63d2'},
  {background:'#ffe2c2',border:'#d9781e'},
  {background:'#d8f3ea',border:'#2a9d78'}
];

async function init(){
  const files=['questions.json','categories.json','languages.json','translations/vi.json','translations/en.json','translations/id.json'];
  const [questions,categories,languages,viTranslations,enTranslations,idTranslations]=await Promise.all(files.map(f=>fetch(DATA_BASE+f).then(r=>{if(!r.ok)throw new Error(`${f}: ${r.status}`);return r.json()})));
  Object.assign(state,{questions,categories,languages,translations:{vi:viTranslations,en:enTranslations,id:idTranslations}});
  const saved=JSON.parse(localStorage.getItem('questionAppSettings')||'{}');
  state.category=saved.category||'';
  state.level=['preA1','A1','both'].includes(saved.level)?saved.level:'both';
  renderSettings();
  renderLanguageMenu();
  bind();
  validateStart();
}

function buttonChoice(text,value,group,selected){
  const b=document.createElement('button');
  b.className='choice'+(selected?' selected':'');
  b.textContent=text;
  b.dataset.value=value;
  b.setAttribute('aria-pressed',String(selected));
  b.onclick=()=>selectChoice(group,value);
  return b;
}

function renderSettings(){
  $('#categories').replaceChildren(...state.categories.filter(x=>x.enabled).map(x=>buttonChoice(x.label_ja,x.category_id,'category',state.category===x.category_id)),buttonChoice('すべて','all','category',state.category==='all'));
  $('#levels').replaceChildren(...[['preA1','preA1'],['A1','A1'],['preA1＋A1','both']].map(x=>buttonChoice(x[0],x[1],'level',state.level===x[1])));
}

function selectChoice(group,value){
  state[group]=value;
  renderSettings();
  validateStart();
}

function releasedLanguages(){
  return state.languages.filter(x=>x.enabled&&x.translation_available&&state.translations[x.language_id]);
}

function renderLanguageMenu(){
  $('#languageOptions').replaceChildren(...releasedLanguages().map(language=>{
    const button=document.createElement('button');
    button.type='button';
    button.setAttribute('role','menuitemradio');
    button.setAttribute('aria-checked',String(state.language===language.language_id));
    button.className=state.language===language.language_id?'selected':'';
    const ja=document.createElement('span');
    ja.textContent=language.language_name_ja;
    const native=document.createElement('small');
    native.lang=language.language_code;
    native.textContent=language.language_name_native;
    button.append(ja,native);
    button.onclick=()=>chooseLanguage(language.language_id);
    return button;
  }));
}

function validateStart(){
  $('#start').disabled=!state.category;
}

function bind(){
  $('#start').onclick=start;
  $('#prev').onclick=prev;
  $('#next').onclick=next;
  $('#toggleTranslation').onclick=handleTranslationButton;
  $('#languageMenuToggle').onclick=toggleLanguageMenu;
  $('#toggleAnswers').onclick=toggleAnswers;
  $('#followup').onclick=followup;
  $('#homeBtn').onclick=()=>$('#homeDialog').showModal();
  $('#cancelHome').onclick=()=>$('#homeDialog').close();
  $('#confirmHome').onclick=goHome;
  $('#endHome').onclick=()=>{$('#endDialog').close();goHome()};
  $('#restart').onclick=()=>{$('#endDialog').close();start()};
  $('#fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
  addEventListener('pointerdown',event=>{if(!$('#translationControl').contains(event.target))closeLanguageMenu()});
  addEventListener('keydown',event=>{
    if($('#quiz').classList.contains('hidden')||event.target.matches('select,button'))return;
    if(event.key==='Escape')closeLanguageMenu();
    if(event.key==='ArrowLeft')prev();
    if(event.key==='ArrowRight')next();
    if(event.key.toLowerCase()==='t')handleTranslationButton();
    if(event.key.toLowerCase()==='a')toggleAnswers();
    if(event.key.toLowerCase()==='h')$('#homeDialog').showModal();
  });
}

function eligible(){
  return state.questions.filter(q=>q.enabled&&q.include_in_random&&(state.category==='all'?!q.personal:q.category_id===state.category)&&(state.level==='both'||q.level===state.level));
}

function start(){
  localStorage.setItem('questionAppSettings',JSON.stringify({category:state.category,level:state.level}));
  state.language='';
  state.queue=shuffle(eligible());
  state.queueTotal=state.queue.length;
  state.history=[];
  state.index=-1;
  resetPanels();
  renderLanguageMenu();
  $('#home').classList.add('hidden');
  $('#quiz').classList.remove('hidden');
  next();
}

function current(){return state.history[state.index]}

function next(){
  resetPanels();
  if(state.index<state.history.length-1){state.index++;render();return}
  if(!state.queue.length){$('#endDialog').showModal();return}
  state.history.push(state.queue.shift());
  state.index++;
  render();
}

function prev(){
  if(state.index<=0)return;
  resetPanels();
  state.index--;
  render();
}

function followup(){
  const q=current(),id=q.follow_up_ids?.[0];
  const child=state.questions.find(x=>x.question_id===id);
  if(!child)return;
  resetPanels();
  state.history=state.history.slice(0,state.index+1);
  state.history.push(child);
  state.index++;
  render();
}

function resetPanels(){
  state.showTranslation=false;
  state.showAnswers=false;
  closeLanguageMenu();
}

function render(){
  const q=current();
  if(!q)return;
  const selectedCategory=state.category==='all'?{label_ja:'すべて'}:state.categories.find(x=>x.category_id===state.category);
  const language=selectedLanguage();
  $('#status').textContent=`${selectedCategory?.label_ja||''}　｜　${state.level==='both'?'preA1＋A1':state.level}${language?'　｜　'+language.language_name_ja:''}`;
  $('#progress').textContent=q.include_in_random?`${state.queueTotal-state.queue.length} / ${state.queueTotal}`:'つづき';
  renderQuestion(q);
  $('#answerList').innerHTML=q.answer_examples.map(x=>`<div>${esc(x)}</div>`).join('');
  $('#prev').disabled=state.index===0;
  $('#followup').classList.toggle('hidden',!q.follow_up_ids?.length);
  updatePanels();
}

function selectedLanguage(){return state.languages.find(x=>x.language_id===state.language)}
function paletteFor(q,groupId){const groups=(q.japanese_segments||[]).map(s=>s.group_id);const index=groups.indexOf(groupId);return palettes[(index<0?0:index)%palettes.length]}
function segmentMarkup(q,s){const p=paletteFor(q,s.group_id);return `<span class="segment" data-group="${esc(s.group_id||'')}" style="--segment-bg:${p.background};--segment-border:${p.border}">${esc(s.text)}</span>`}

function renderQuestion(q){
  const segments=q.japanese_segments?.length?q.japanese_segments:[{group_id:'g1',text:q.japanese_plain}];
  $('#question').classList.toggle('highlight',state.showTranslation&&translationAvailable(q));
  $('#question').innerHTML=segments.map(s=>segmentMarkup(q,s)).join('<span aria-hidden="true"> </span>');
}

function translationFor(q=current()){return q?state.translations[state.language]?.find(x=>x.question_id===q.question_id):null}
function translationAvailable(q=current()){const entry=translationFor(q);return Boolean(entry&&entry.status==='approved'&&entry.plain)}

function handleTranslationButton(){
  if(!state.language||!translationAvailable()){openLanguageMenu();return}
  state.showTranslation=!state.showTranslation;
  renderQuestion(current());
  updatePanels();
}

function chooseLanguage(languageId){
  state.language=languageId;
  state.showTranslation=true;
  closeLanguageMenu();
  renderLanguageMenu();
  render();
}

function toggleLanguageMenu(){
  $('#languageMenu').classList.contains('hidden')?openLanguageMenu():closeLanguageMenu();
}

function openLanguageMenu(){
  $('#languageMenu').classList.remove('hidden');
  $('#languageMenuToggle').setAttribute('aria-expanded','true');
}

function closeLanguageMenu(){
  $('#languageMenu').classList.add('hidden');
  $('#languageMenuToggle').setAttribute('aria-expanded','false');
}

function toggleAnswers(){
  state.showAnswers=!state.showAnswers;
  updatePanels();
}

function updatePanels(){
  const q=current(),entry=translationFor(q),available=Boolean(state.language&&translationAvailable(q));
  const language=selectedLanguage();
  $('#translationLabel').textContent=language?`対訳：${language.language_name_ja}`:'対訳を選ぶ';
  $('#toggleTranslation').classList.toggle('active',state.showTranslation&&available);
  $('#languageMenuToggle').classList.toggle('active',state.showTranslation&&available);
  $('#toggleTranslation').setAttribute('aria-pressed',String(state.showTranslation&&available));
  $('#translation').classList.toggle('hidden',!state.showTranslation||!available);
  $('#translationNotice').classList.toggle('hidden',!state.language||available);
  if(state.showTranslation&&available){
    const segments=entry.segments?.length?entry.segments:[{group_id:'g1',text:entry.plain}];
    $('#translation').innerHTML=segments.map(s=>segmentMarkup(q,s)).join('<span aria-hidden="true"> </span>');
    $('#translation').lang=language?.language_code||'';
    $('#translation').dir=language?.direction||'ltr';
    $('#translation').style.fontFamily=language?.font_stack||'';
  }else $('#translation').replaceChildren();
  $('#answers').classList.toggle('hidden',!state.showAnswers);
  $('#toggleAnswers').innerHTML=`<span class="action-key">A</span>${state.showAnswers?'回答例を隠す':'回答例を表示'}`;
  $('#toggleAnswers').classList.toggle('active',state.showAnswers);
  $('#toggleAnswers').setAttribute('aria-pressed',String(state.showAnswers));
}

function goHome(){
  $('#homeDialog').close();
  $('#quiz').classList.add('hidden');
  $('#home').classList.remove('hidden');
  state.history=[];
  state.queue=[];
  state.language='';
  resetPanels();
  renderSettings();
  renderLanguageMenu();
  validateStart();
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
init().catch(e=>{document.body.innerHTML='<p style="padding:2rem">データを読み込めませんでした。</p>';console.error(e)});
