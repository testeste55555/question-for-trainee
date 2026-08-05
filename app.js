const DATA_BASE='data/';
const state={category:'',level:'both',translation:false,country:'',language:'',questions:[],categories:[],countries:[],languages:[],translations:{},queue:[],history:[],index:-1,showTranslation:false,showAnswers:false};
const $=s=>document.querySelector(s);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const labels={both:'preA1＋A1'};
const palettes=[
  {background:'#dceeff',border:'#4a90e2'},
  {background:'#fff2b8',border:'#c99a00'},
  {background:'#eadfff',border:'#8a63d2'},
  {background:'#ffe2c2',border:'#d9781e'},
  {background:'#d8f3ea',border:'#2a9d78'}
];
async function init(){
  const [questions,categories,countries,languages,enTranslations,idTranslations]=await Promise.all(['questions.json','categories.json','countries.json','languages.json','translations/en.json','translations/id.json'].map(f=>fetch(DATA_BASE+f).then(r=>{if(!r.ok)throw new Error(`${f}: ${r.status}`);return r.json()})));
  Object.assign(state,{questions,categories,countries,languages,translations:{en:enTranslations,id:idTranslations}});
  const saved=JSON.parse(localStorage.getItem('questionAppSettings')||'{}');Object.assign(state,{category:saved.category||'',level:saved.level||'both',translation:!!saved.translation,country:saved.country||'',language:saved.language||''});
  renderSettings();bind();validateStart();
}
function buttonChoice(text,value,group,selected){const b=document.createElement('button');b.className='choice'+(selected?' selected':'');b.textContent=text;b.dataset.value=value;b.onclick=()=>selectChoice(group,value);return b}
function renderSettings(){
  $('#categories').replaceChildren(...state.categories.filter(x=>x.enabled).map(x=>buttonChoice(x.label_ja,x.category_id,'category',state.category===x.category_id)),buttonChoice('すべて','all','category',state.category==='all'));
  $('#levels').replaceChildren(...[['preA1','preA1'],['A1','A1'],['preA1＋A1','both']].map(x=>buttonChoice(x[0],x[1],'level',state.level===x[1])));
  $('#translationMode').replaceChildren(buttonChoice('なし','off','translation',!state.translation),buttonChoice('あり','on','translation',state.translation));
  $('#translationSettings').classList.toggle('hidden',!state.translation);
  $('#country').replaceChildren(new Option('えらんでください',''),...state.countries.filter(x=>x.enabled).map(x=>new Option(x.country_name_ja,x.country_id)));
  $('#country').value=state.country;renderLanguages();
}
function selectChoice(group,value){if(group==='translation')state.translation=value==='on';else state[group]=value;renderSettings();validateStart()}
function renderLanguages(){const c=state.countries.find(x=>x.country_id===state.country);const needs=c?.requires_language_selection;$('#languageWrap').classList.toggle('hidden',!needs);if(c){if(!needs)state.language=c.default_language_id;else{$('#language').replaceChildren(new Option('えらんでください',''),...c.language_ids.map(id=>new Option(state.languages.find(x=>x.language_id===id)?.language_name_ja||id,id)));$('#language').value=state.language}}else state.language=''}
function validateStart(){const c=state.countries.find(x=>x.country_id===state.country);$('#start').disabled=!(state.category&&state.level&&(!state.translation||(c&&(!c.requires_language_selection||state.language))))}
function bind(){
  $('#country').onchange=e=>{state.country=e.target.value;state.language='';renderLanguages();validateStart()};$('#language').onchange=e=>{state.language=e.target.value;validateStart()};
  $('#start').onclick=start;$('#prev').onclick=prev;$('#next').onclick=next;$('#toggleTranslation').onclick=toggleTranslation;$('#toggleAnswers').onclick=toggleAnswers;$('#followup').onclick=followup;
  $('#homeBtn').onclick=()=>$('#homeDialog').showModal();$('#cancelHome').onclick=()=>$('#homeDialog').close();$('#confirmHome').onclick=goHome;$('#endHome').onclick=()=>{$('#endDialog').close();goHome()};$('#restart').onclick=()=>{$('#endDialog').close();start()};
  $('#fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
  addEventListener('keydown',e=>{if($('#quiz').classList.contains('hidden')||e.target.matches('select,button'))return;if(e.key==='ArrowLeft')prev();if(e.key==='ArrowRight')next();if(e.key.toLowerCase()==='t')toggleTranslation();if(e.key.toLowerCase()==='a')toggleAnswers();if(e.key.toLowerCase()==='h')$('#homeDialog').showModal()});
}
function eligible(){return state.questions.filter(q=>q.enabled&&q.include_in_random&&(state.category==='all'?!q.personal:q.category_id===state.category)&&(state.level==='both'||q.level===state.level))}
function start(){localStorage.setItem('questionAppSettings',JSON.stringify({category:state.category,level:state.level,translation:state.translation,country:state.country,language:state.language}));state.queue=shuffle(eligible());state.history=[];state.index=-1;$('#home').classList.add('hidden');$('#quiz').classList.remove('hidden');next()}
function current(){return state.history[state.index]}
function next(){resetPanels();if(state.index<state.history.length-1){state.index++;render();return}if(!state.queue.length){$('#endDialog').showModal();return}state.history.push(state.queue.shift());state.index++;render()}
function prev(){if(state.index<=0)return;resetPanels();state.index--;render()}
function followup(){const q=current(),id=q.follow_up_ids?.[0];const child=state.questions.find(x=>x.question_id===id);if(!child)return;resetPanels();state.history=state.history.slice(0,state.index+1);state.history.push(child);state.index++;render()}
function resetPanels(){state.showTranslation=false;state.showAnswers=false}
function render(){const q=current();if(!q)return;const cat=state.categories.find(x=>x.category_id===q.category_id);const lang=state.languages.find(x=>x.language_id===state.language);$('#status').textContent=`${cat?.label_ja||''}　｜　${q.level}${state.translation&&lang?'　｜　'+lang.language_name_ja:''}`;renderQuestion(q);$('#answerList').innerHTML=q.answer_examples.map(x=>`<div>${esc(x)}</div>`).join('');$('#prev').disabled=state.index===0;$('#followup').classList.toggle('hidden',!q.follow_up_ids?.length);updatePanels()}
function paletteFor(q,groupId){const groups=(q.japanese_segments||[]).map(s=>s.group_id);const index=groups.indexOf(groupId);return palettes[(index<0?0:index)%palettes.length]}
function segmentMarkup(q,s){const p=paletteFor(q,s.group_id);return `<span class="segment" data-group="${esc(s.group_id||'')}" style="--segment-bg:${p.background};--segment-border:${p.border}">${esc(s.text)}</span>`}
function renderQuestion(q){const segments=q.japanese_segments?.length?q.japanese_segments:[{group_id:'g1',text:q.japanese_plain}];$('#question').classList.toggle('highlight',state.showTranslation&&translationAvailable(q));$('#question').innerHTML=segments.map(s=>segmentMarkup(q,s)).join('<span aria-hidden="true"> </span>')}
function translationFor(q=current()){return q?state.translations[state.language]?.find(x=>x.question_id===q.question_id):null}
function translationAvailable(q=current()){const entry=translationFor(q);return Boolean(entry&&entry.status==='approved'&&entry.plain)}
function toggleTranslation(){if(!state.translation||!translationAvailable())return;state.showTranslation=!state.showTranslation;renderQuestion(current());updatePanels()}
function toggleAnswers(){state.showAnswers=!state.showAnswers;updatePanels()}
function updatePanels(){const q=current(),entry=translationFor(q),available=state.translation&&translationAvailable(q);$('#toggleTranslation').disabled=!available;$('#toggleTranslation').textContent=state.showTranslation?'対訳を隠す':'対訳を表示';$('#translation').classList.toggle('hidden',!state.showTranslation||!available);$('#translationNotice').classList.toggle('hidden',!state.translation||available);if(state.showTranslation&&available){const segments=entry.segments?.length?entry.segments:[{group_id:'g1',text:entry.plain}];$('#translation').innerHTML=segments.map(s=>segmentMarkup(q,s)).join('<span aria-hidden="true"> </span>')}else $('#translation').replaceChildren();$('#answers').classList.toggle('hidden',!state.showAnswers);$('#toggleAnswers').textContent=state.showAnswers?'回答例を隠す':'回答例を表示'}
function goHome(){$('#homeDialog').close();$('#quiz').classList.add('hidden');$('#home').classList.remove('hidden');state.history=[];state.queue=[];renderSettings();validateStart()}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
init().catch(e=>{document.body.innerHTML='<p style="padding:2rem">データを読み込めませんでした。</p>';console.error(e)});
