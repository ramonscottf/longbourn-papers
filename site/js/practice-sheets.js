(function(){
"use strict";
var PAPER = { letter:{w:215.9,h:279.4,label:'US Letter'}, a4:{w:210,h:297,label:'A4'} };
var STYLES = [
  {id:'copper', l:'Copperplate ghost', font:"'Pinyon Script', cursive", scale:3.0, slantDefault:true},
  {id:'modern', l:'Modern ghost',      font:"'Sacramento', cursive",    scale:2.4, slantDefault:false},
  {id:'blank',  l:'Blank guides'},
  {id:'drills', l:'Drill rows',        font:"'Pinyon Script', cursive", scale:3.0, slantDefault:true}
];
var DRILLS = ['iiiiiiiiii','uuuuuuuu','nnnnnnnn','mmmmmm','oooooooo','minimum minimum','hhhh llll bbbb','gggg yyyy jjjj'];
var XH = [{id:6,l:'Small · 6mm'},{id:8,l:'Medium · 8mm'},{id:10,l:'Large · 10mm'}];
var SLANT = [{id:'on',l:'55° lines'},{id:'off',l:'None'}];
var st = { style:'copper', x:8, slant:'on', paper:'letter', phrase:'practice makes progress' };

function pills(host, items, key, sel){
  document.getElementById(host).innerHTML = items.map(function(x){
    return '<button class="vpill'+(String(sel)===String(x.id)?' is-selected':'')+'" data-k="'+key+'" data-v="'+x.id+'">'+(x.l||x.id)+'</button>';
  }).join('');
}
function styleDef(){ for(var i=0;i<STYLES.length;i++) if(STYLES[i].id===st.style) return STYLES[i]; }

function build(){
  var p = PAPER[st.paper], m = 14, xh = Number(st.x);
  var rowH = 3*xh, gap = Math.round(xh*0.9), top = m+6, bottom = p.h-m-6;
  var rows = Math.max(1, Math.floor((bottom-top+gap) / (rowH+gap)));
  var sd = styleDef(), ghost = (st.style==='copper'||st.style==='modern'||st.style==='drills');
  var s = '<svg xmlns="http://www.w3.org/2000/svg" width="'+p.w+'mm" height="'+p.h+'mm" viewBox="0 0 '+p.w+' '+p.h+'">';
  s += '<rect width="'+p.w+'" height="'+p.h+'" fill="#ffffff"/>';
  for(var i=0;i<rows;i++){
    var y0 = top + i*(rowH+gap);
    var yw = y0+xh, yb = y0+2*xh, yd = y0+3*xh;
    // slant lines first (under everything): 55° from baseline -> dx = rowH / tan(55°)
    if(st.slant==='on'){
      var dx = rowH / Math.tan(55*Math.PI/180), step = 12;
      for(var x=m; x<=p.w-m; x+=step){
        s += '<line x1="'+x+'" y1="'+yd+'" x2="'+(x+dx)+'" y2="'+y0+'" stroke="#c9d4de" stroke-width="0.18"/>';
      }
    }
    s += '<line x1="'+m+'" y1="'+y0+'" x2="'+(p.w-m)+'" y2="'+y0+'" stroke="#b9c3cc" stroke-width="0.2" stroke-dasharray="1.6 1.6"/>';
    s += '<line x1="'+m+'" y1="'+yw+'" x2="'+(p.w-m)+'" y2="'+yw+'" stroke="#8fa0ae" stroke-width="0.25"/>';
    s += '<line x1="'+m+'" y1="'+yb+'" x2="'+(p.w-m)+'" y2="'+yb+'" stroke="#5d7183" stroke-width="0.35"/>';
    s += '<line x1="'+m+'" y1="'+yd+'" x2="'+(p.w-m)+'" y2="'+yd+'" stroke="#b9c3cc" stroke-width="0.2" stroke-dasharray="1.6 1.6"/>';
    if(ghost){
      var txt = st.style==='drills' ? DRILLS[i % DRILLS.length] : (st.phrase||'').trim();
      if(txt){
        txt = txt.replace(/&/g,'&amp;').replace(/</g,'&lt;');
        s += '<text x="'+(m+3)+'" y="'+yb+'" font-family="'+sd.font.replace(/"/g,'&quot;')+'" font-size="'+(xh*sd.scale*0.52)+'" fill="#9aa4ad" opacity="0.5">'+txt+'</text>';
      }
    }
  }
  s += '<text x="'+(p.w/2)+'" y="'+(p.h-6)+'" text-anchor="middle" font-family="Georgia, serif" font-size="2.6" fill="#9aa4ad">longbournpapers.com/writing-desk \u00b7 free practice sheets \u00b7 Longbourn Papers, printed one sheet at a time</text>';
  s += '</svg>';
  document.getElementById('sheetWrap').innerHTML = s;
  document.getElementById('pageStyle').textContent = '@page { size: '+(st.paper==='a4'?'A4':'letter')+' portrait; margin: 0; }';
  document.getElementById('phraseRow').style.display = (st.style==='copper'||st.style==='modern') ? '' : 'none';
}
function renderControls(){
  pills('psStyle', STYLES, 'style', st.style);
  pills('psX', XH, 'x', st.x);
  pills('psSlant', SLANT, 'slant', st.slant);
  pills('psPaper', [{id:'letter',l:'US Letter'},{id:'a4',l:'A4'}], 'paper', st.paper);
}
document.addEventListener('click', function(e){
  var p = e.target.closest('.vpill[data-k]');
  if(p){
    st[p.dataset.k] = p.dataset.v;
    if(p.dataset.k==='style'){ var sd=styleDef(); if(sd && 'slantDefault' in sd) st.slant = sd.slantDefault?'on':'off'; }
    renderControls(); build(); return;
  }
  if(e.target.id==='psPrint') window.print();
});
document.getElementById('psPhrase').addEventListener('input', function(e){ st.phrase = e.target.value; build(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
renderControls(); build();
})();
