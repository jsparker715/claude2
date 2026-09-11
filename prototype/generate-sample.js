// Generates example BcbaReport[] by running the compiled engine on synthetic
// sessions/PTO/pairings. Output feeds the prototype dashboard.
// Run `npm run build` first so dist/ exists, then `node prototype/generate-sample.js`.
const path = require('path');
const { buildAllReports } = require(path.join(__dirname, '..', 'dist', 'engine'));
const T = require(path.join(__dirname, '..', 'dist', 'engine', 'defaults'));

function mondaysBetween(startISO, endISO){
  const out=[]; let d=new Date(startISO+'T00:00:00Z');
  while(d.getUTCDay()!==1) d.setUTCDate(d.getUTCDate()+1);
  const end=new Date(endISO+'T00:00:00Z');
  while(d<=end){ out.push(d.toISOString().slice(0,10)); d=new Date(d); d.setUTCDate(d.getUTCDate()+7);}
  return out;
}
const sessions=[]; const pairings=[]; const configs=[];

function addBcba(name,email,clients,plan){
  clients.forEach(c=>pairings.push({bcba:name,client:c}));
  const weeks=mondaysBetween('2026-01-01','2026-06-30');
  weeks.forEach((mon,wi)=>{
    const w=plan(wi);
    const client=clients[wi%clients.length];
    const day=(off)=>{const dt=new Date(mon+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()+off);return dt.toISOString().slice(0,10);};
    // Tech-delivered direct therapy (caseload) — drives supervision ratio denominator
    if(w.techDirect>0) sessions.push({client,teamMember:'Tech Team',billingCode:'97153',durationHours:w.techDirect,date:day(0)});
    // BCBA personally delivers supervision (97155) — split some to telehealth
    if(w.supervision>0){
      const th=+(w.supervision*(w.telehealthShare||0)).toFixed(2);
      if(w.supervision-th>0) sessions.push({client,teamMember:name,billingCode:'97155',durationHours:+(w.supervision-th).toFixed(2),date:day(1)});
      if(th>0) sessions.push({client,teamMember:name,billingCode:'97155',durationHours:th,date:day(1),telehealth:true});
    }
    // BCBA personally delivers caregiver training (97156)
    if(w.caregiver>0) sessions.push({client,teamMember:name,billingCode:'97156',durationHours:w.caregiver,date:day(3)});
  });
  configs.push({name,email,requiredHoursByMonth:{
    '2026-01':40,'2026-02':40,'2026-03':40,'2026-04':40,'2026-05':40,'2026-06':40
  },targets:T.PLACEHOLDER_TARGETS});
}

// Sam: over target both quarters, healthy ratio + caregiver, telehealth within cap -> BONUS
addBcba('Dr. Sam Rivera','sam@brightpath.org',['Client Alvarez','Client Brooks'],(wi)=>({
  techDirect: 40, supervision: 10.5, caregiver: (wi%2===0?2:0), telehealthShare: 0.15
}));
// Priya: Q1 short (deficit -> rollover to Q2) + Q1 telehealth over cap; Q2 recovers
addBcba('Dr. Priya Chen','priya@brightpath.org',['Client Cho','Client Diaz','Client Evans'],(wi)=>{
  const q1 = wi < 13;
  return { techDirect: 38, supervision: q1?6:12, caregiver: (wi%3===0?2:0), telehealthShare: q1?0.55:0.2 };
});
// Marcus: hours fine, but ratio too low + zero caregiver training -> BONUS BLOCKED
addBcba('Dr. Marcus Bell','marcus@brightpath.org',['Client Flores','Client Gray'],(wi)=>({
  techDirect: 130, supervision: 10.5, caregiver: 0, telehealthShare: 0.1
}));

const pto=[
  {employee:'Dr. Sam Rivera',hours:24,startDate:'2026-05-11'},
  {employee:'Dr. Priya Chen',hours:16,startDate:'2026-02-17'},
];

const reports = buildAllReports({sessions,pto,pairings,configs});
require('fs').writeFileSync(path.join(__dirname,'sample-reports.json'),JSON.stringify(reports));
reports.forEach(r=>{
  const q1=r.periods.find(p=>p.periodKey==='2026-Q1');
  const q2=r.periods.find(p=>p.periodKey==='2026-Q2');
  console.log(r.bcba.padEnd(16),
    '| Q1 bill',q1.billableHours.toFixed(0),'eff',q1.effectiveRequiredHours,'var',q1.variance.toFixed(0),'rollOut',q1.rollingOutHours.toFixed(1),'tele',(q1.telehealthCheck.value*100).toFixed(0)+'%',
    '| Q2 bill',q2.billableHours.toFixed(0),'eff',q2.effectiveRequiredHours.toFixed(0),'rolledIn',q2.rolledInHours.toFixed(1),
    'ratio',(q2.supervisionRatioCheck.value*100).toFixed(0)+'%','bonus$',q2.bonus.amount.toFixed(0),'blk',JSON.stringify(q2.bonus.blockedBy));
});
