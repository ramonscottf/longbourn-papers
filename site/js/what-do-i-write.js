(function(){
"use strict";
/* Lines may carry tone: [] and rel: [] restrictions; untagged = fits everything. */
var RELS=[{id:'family',l:'Family'},{id:'friend',l:'Close friend'},{id:'colleague',l:'Colleague'},{id:'acquaintance',l:'Acquaintance'}];
var TONES=[{id:'warm',l:'Warm'},{id:'light',l:'Light-hearted'},{id:'formal',l:'Formal'}];
var D=[
{id:'thankyou',l:'Thank you',guide:'/journal/how-to-write-a-thank-you-note/',
 open:[
  {t:'Thank you for [the thing] — I haven\u2019t stopped thinking about it.'},
  {t:'I\u2019m writing before the week swallows me, because you deserve better than a text: thank you.'},
  {t:'You have a gift for knowing exactly what a person needs. Thank you.',tone:['warm']},
  {t:'Consider this note legally binding proof that I owe you one.',tone:['light']},
  {t:'I wanted to thank you properly for your generosity — it made a real difference.',tone:['formal'],rel:['colleague','acquaintance']},
  {t:'The house is better with your gift in it, and I\u2019m better for knowing you.',tone:['warm'],rel:['family','friend']}],
 prompt:['Name the specific thing — the gift, the dinner, the favor. Specificity is the whole game.',
  'Say what it meant or where it lives now: the shelf it sits on, the evening it saved, the habit it started.',
  'Point at the future: the next visit, the return invitation, the photo you\u2019ll send.'],
 close:[{t:'With so much gratitude,'},{t:'Gratefully yours,',tone:['formal']},{t:'With love,',rel:['family','friend']},{t:'You\u2019re the best — thank you again,',tone:['light']},{t:'Warmly,'}],
 avoid:['\u201CThanks for everything!\u201D — everything is nothing; name the thing.','Apologizing for your handwriting or the delay in more than one clause.','Turning a note into an essay. Five sentences honors the reader.']},
{id:'sympathy',l:'Sympathy',guide:'/journal/what-to-write-in-a-sympathy-card/',
 open:[
  {t:'I was so sorry to hear about [name]\u2019s death. I\u2019ve been thinking of you constantly.'},
  {t:'There\u2019s nothing I can write that meets this, but I couldn\u2019t let it pass without telling you how sorry I am.'},
  {t:'I keep thinking of [name] — [a specific memory]. The world was better with them in it.',tone:['warm']},
  {t:'Please accept my deepest sympathy on the loss of [name].',tone:['formal'],rel:['colleague','acquaintance']},
  {t:'I don\u2019t have the right words, so I\u2019ll send the true ones: I\u2019m so sorry, and I\u2019m here.',rel:['family','friend']}],
 prompt:['If you knew them: one specific memory is worth more than any comfort you can compose.',
  'If you didn\u2019t: write about the person you\u2019re addressing — witness their love.',
  'Make one concrete offer with a date on it: \u201CI\u2019m dropping dinner Thursday — no need to answer the door.\u201D'],
 close:[{t:'With love,'},{t:'Holding you all close,'},{t:'With deepest sympathy,',tone:['formal']},{t:'With you in this,'}],
 avoid:['\u201CEverything happens for a reason\u201D / \u201Cthey\u2019re in a better place\u201D — comfort only if you know they share the faith.','\u201CI know how you feel\u201D — grief isn\u2019t transferable.','Any sentence that begins with \u201Cat least.\u201D','\u201CLet me know if you need anything\u201D — make the offer specific and dated instead.']},
{id:'congrats',l:'Congratulations',
 open:[
  {t:'You did it — and nobody deserves it more. Congratulations.'},
  {t:'I heard the news and grinned for a solid minute. Congratulations!'},
  {t:'Warmest congratulations on [the achievement] — richly deserved.',tone:['formal']},
  {t:'Years of work just became overnight success. Congratulations.',tone:['light']},
  {t:'I\u2019ve watched you work toward this, and I\u2019m so proud I could burst.',tone:['warm'],rel:['family','friend']}],
 prompt:['Name the achievement precisely — the promotion, the degree, the finish line.','Say what you witnessed along the way: the late nights, the second attempt, the nerve it took.','Raise a glass forward: what this opens up, and when you\u2019ll celebrate together.'],
 close:[{t:'Cheering loudly,',tone:['light']},{t:'With admiration,'},{t:'So very proud of you,',rel:['family','friend']},{t:'Congratulations again,',tone:['formal']}],
 avoid:['Making it about you (\u201CI always said\u2026\u201D).','\u201CFinally!\u201D — it lands as a jab.','Hedging the praise with advice for what\u2019s next.']},
{id:'baby',l:'New baby',
 open:[
  {t:'Welcome to the world, little one — and congratulations to the luckiest parents in it.'},
  {t:'A whole new person! We are so happy for you.'},
  {t:'Warmest congratulations on [name]\u2019s arrival.',tone:['formal']},
  {t:'May your coffee be strong and your naps miraculous. Congratulations!',tone:['light']}],
 prompt:['Use the baby\u2019s name if you know it — it\u2019s music to new parents.','Say something kind about the parents they\u2019ll be — evidence-based if possible.','Offer the dated, concrete kind of help: a meal on the porch, an errand run, a specific evening.'],
 close:[{t:'With so much love to all three of you,',rel:['family','friend']},{t:'Welcome, little one,'},{t:'With warmest wishes,',tone:['formal']},{t:'Sleep when you can,',tone:['light']}],
 avoid:['Advice. All of it. They\u2019ve heard it.','\u201CEnjoy every moment\u201D — some moments are 3 a.m.','Asking when you can visit inside the congratulations card.']},
{id:'wedding',l:'Wedding',
 open:[
  {t:'Watching you two today, everything made sense. Congratulations.'},
  {t:'Here\u2019s to the easiest \u201Cyes\u201D either of you will ever say. Congratulations!',tone:['light']},
  {t:'Heartfelt congratulations on your marriage — may it be long and bright.',tone:['formal']},
  {t:'Some couples make marriage look like luck. You two make it look like craftsmanship.',tone:['warm']}],
 prompt:['Say what you see in them as a pair — the specific way they fit.','If you were there: name one moment from the day you\u2019ll keep.','Wish them something real: a kitchen full of laughter, arguments that end kindly, a long table of friends.'],
 close:[{t:'To the two of you,'},{t:'With all our love,',rel:['family','friend']},{t:'With every good wish for your marriage,',tone:['formal']},{t:'Save us a dance at the fiftieth,',tone:['light']}],
 avoid:['Marriage advice, unless you\u2019re their grandmother and it\u2019s one line.','Jokes about losing freedom — retire them.','Mentioning the ex. Obviously. And yet.']},
{id:'getwell',l:'Get well',
 open:[
  {t:'I heard you\u2019re under the weather, and the weather should be ashamed of itself.',tone:['light']},
  {t:'Thinking of you and sending every good thing toward a quick recovery.'},
  {t:'Wishing you rest, good care, and a steady road back.',tone:['formal']},
  {t:'The world is noticeably duller without you at full strength. Mend soon.',tone:['warm']}],
 prompt:['Keep it light on the illness, heavy on the person — what you miss, what\u2019s waiting for them.','Offer one dated, specific thing: soup Thursday, the school run, taking a shift with the dog.','Give permission to rest — no reply required, no visitors expected.'],
 close:[{t:'Mend well and slowly,'},{t:'Thinking of you daily,'},{t:'With warm wishes for your recovery,',tone:['formal']},{t:'Back soon, or else,',tone:['light']}],
 avoid:['Prognosis talk or comparing them to someone you knew with the same thing.','\u201CEverything happens for a reason.\u201D','Demanding updates — the sick owe you nothing.']},
{id:'thinking',l:'Thinking of you',
 open:[
  {t:'No occasion — you just crossed my mind and I decided to make it official.'},
  {t:'This card exists because I miss you, and paper felt more honest than a text.'},
  {t:'I was thinking of you today and wanted you to have the evidence.',tone:['warm']},
  {t:'I\u2019ve been meaning to write — you\u2019ve been on my mind.',tone:['formal']}],
 prompt:['Name the trigger: the song, the street, the recipe, the joke that summoned them.','Share one small piece of your news — a note is a visit, bring something.','Ask them one real question; give the reply somewhere to land.'],
 close:[{t:'Missing you,',rel:['family','friend']},{t:'Fondly,'},{t:'Thinking of you often,'},{t:'Write back when the mood strikes,',tone:['light']}],
 avoid:['Guilt about the time since you last spoke — one warm clause, maximum.','Making it a life-update essay. Notes are visits, not memoirs.']},
{id:'apology',l:'Apology',
 open:[
  {t:'I owe you an apology, and I wanted to make it in ink: I\u2019m sorry.'},
  {t:'I\u2019ve thought a great deal about [what happened], and I got it wrong. I\u2019m sorry.'},
  {t:'Please accept my sincere apology for [what happened].',tone:['formal']},
  {t:'No excuses in this card — just the apology you should have had sooner.',tone:['warm']}],
 prompt:['Name what you did, plainly — an apology that won\u2019t say the thing isn\u2019t one.','Acknowledge the cost to them, without \u201Cif\u201D: not \u201Cif I hurt you\u201D but \u201CI hurt you.\u201D','Say what changes, then stop. Don\u2019t ask for forgiveness in the same breath; leave room.'],
 close:[{t:'With genuine regret,',tone:['formal']},{t:'Humbly,'},{t:'With love and a resolve to do better,',rel:['family','friend']},{t:'Sincerely,'}],
 avoid:['\u201CI\u2019m sorry you feel that way\u201D — that\u2019s an accusation in a trench coat.','Explaining more than you apologize. The ratio matters.','Demanding absolution by return of post.']}
];
var st={occ:'thankyou',rel:'friend',tone:'warm'};
function pills(el,items,key){
  var host=document.getElementById(el);
  host.innerHTML=items.map(function(x){return '<button class="vpill'+(st[key]===x.id?' is-selected':'')+'" data-k="'+key+'" data-v="'+x.id+'">'+(x.l||x.id)+'</button>';}).join('');
}
function fits(line){
  if(line.tone&&line.tone.indexOf(st.tone)<0)return false;
  if(line.rel&&line.rel.indexOf(st.rel)<0)return false;
  return true;
}
function block(title,lines,copy){
  var rows=lines.map(function(x){var t=(typeof x==='string')?x:x.t;
    return '<div class="wt-line"><p>'+t+'</p>'+(copy?'<button class="wt-copy" data-t="'+t.replace(/"/g,'&quot;')+'">Copy</button>':'')+'</div>';}).join('');
  return '<div class="wt-block"><h3>'+title+'</h3>'+rows+'</div>';
}
function render(){
  pills('occ',D,'occ');pills('rel',RELS,'rel');pills('tone',TONES,'tone');
  var o=null;for(var i=0;i<D.length;i++)if(D[i].id===st.occ)o=D[i];
  var opens=o.open.filter(fits);if(!opens.length)opens=o.open;
  var closes=o.close.filter(fits);if(!closes.length)closes=o.close;
  var out='';
  out+=block('Opening lines — borrow one',opens,true);
  out+=block('The middle — say this',o.prompt,false);
  out+=block('Closings',closes,true);
  out+='<div class="wt-block wt-avoid"><h3>Leave these out</h3><ul>'+o.avoid.map(function(a){return '<li>'+a+'</li>';}).join('')+'</ul></div>';
  if(o.guide)out+='<p class="wt-guide">Want the full craft? Read the guide: <a href="'+o.guide+'">the complete '+o.l.toLowerCase()+' guide &rarr;</a></p>';
  document.getElementById('out').innerHTML=out;
}
document.addEventListener('click',function(e){
  var p=e.target.closest('.vpill[data-k]');
  if(p){st[p.dataset.k]=p.dataset.v;render();return;}
  var c=e.target.closest('.wt-copy');
  if(c&&navigator.clipboard){navigator.clipboard.writeText(c.dataset.t).then(function(){c.classList.add('did');c.textContent='Copied';setTimeout(function(){c.classList.remove('did');c.textContent='Copy';},1400);});}
});
render();
})();
