import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const STORAGE_KEY = "reclaim_ca_v1"; // legacy; data now lives in Supabase

const STAGES = [
  { id: "lead",             label: "Lead",             color: "var(--stage-lead-fg)",      bg: "var(--stage-lead-bg)" },
  { id: "contacted",        label: "Contacted",        color: "var(--stage-contacted-fg)", bg: "var(--stage-contacted-bg)" },
  { id: "agreement_sent",   label: "Agreement Sent",   color: "var(--stage-agreement-fg)", bg: "var(--stage-agreement-bg)" },
  { id: "signed",           label: "Signed",           color: "var(--stage-signed-fg)",    bg: "var(--stage-signed-bg)" },
  { id: "claim_filed",      label: "Claim Filed",      color: "var(--stage-filed-fg)",     bg: "var(--stage-filed-bg)" },
  { id: "payout_confirmed", label: "Payout Confirmed", color: "var(--stage-payout-fg)",    bg: "var(--stage-payout-bg)" },
  { id: "fee_collected",    label: "Fee Collected",    color: "var(--stage-collected-fg)", bg: "var(--stage-collected-bg)" },
  { id: "closed_lost",      label: "Closed Lost",      color: "var(--stage-lost-fg)",      bg: "var(--stage-lost-bg)" },
];

const PROPERTY_TYPES = [
  "Bank Account","Insurance Policy","Wages / Payroll","Stocks / Securities",
  "Tax Refund","Safe Deposit Box","Utility Deposit","Gift Card / Credit",
  "Pension / Retirement","Other"
];

const SOURCES = [
  "MissingMoney.com","State Treasury Site","Skip Trace Match",
  "Referral","BatchData","Manual Research","Other"
];

const US_STATES = [
  {abbr:"AL",name:"Alabama",feeCap:10,days:90,notes:"10% fee cap. Annual report due Nov 1.",url:"https://treasury.alabama.gov/unclaimed-property/"},
  {abbr:"AK",name:"Alaska",feeCap:null,days:60,notes:"No fee cap. Simple online claim process.",url:"https://treasury.alaska.gov/"},
  {abbr:"AZ",name:"Arizona",feeCap:null,days:90,notes:"No fee cap. 3-year dormancy for most.",url:"https://www.azunclaimed.gov/"},
  {abbr:"AR",name:"Arkansas",feeCap:null,days:60,notes:"No fee cap.",url:"https://www.auditor.ar.gov/unclaimedproperty"},
  {abbr:"CA",name:"California",feeCap:10,days:180,notes:"10% fee cap (CCP § 1582). Claim free at claimit.ca.gov. Data refreshed weekly.",url:"https://claimit.ca.gov/"},
  {abbr:"CO",name:"Colorado",feeCap:null,days:90,notes:"No fee cap. Modern online portal.",url:"https://colorado.findyourunclaimedproperty.com/"},
  {abbr:"CT",name:"Connecticut",feeCap:null,days:120,notes:"No fee cap.",url:"https://portal.ct.gov/DRS/Unclaimed-Property"},
  {abbr:"DE",name:"Delaware",feeCap:null,days:120,notes:"No fee cap. Large corporate holdings.",url:"https://unclaimedproperty.delaware.gov/"},
  {abbr:"FL",name:"Florida",feeCap:25,days:90,notes:"25% fee cap strictly enforced.",url:"https://www.fldfs.com/eservices/"},
  {abbr:"GA",name:"Georgia",feeCap:null,days:90,notes:"No fee cap. Friendly for recovery agents.",url:"https://www.georgia.gov/unclaimed-property"},
  {abbr:"HI",name:"Hawaii",feeCap:null,days:120,notes:"No fee cap.",url:"https://budget.hawaii.gov/unclaimed-property/"},
  {abbr:"ID",name:"Idaho",feeCap:null,days:60,notes:"No fee cap. Fast processing.",url:"https://tax.idaho.gov/unclaimed-property/"},
  {abbr:"IL",name:"Illinois",feeCap:null,days:90,notes:"No fee cap. Good online search.",url:"https://icash.illinoistreasurer.gov/"},
  {abbr:"IN",name:"Indiana",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.in.gov/tos/unclaimed_property/"},
  {abbr:"IA",name:"Iowa",feeCap:null,days:60,notes:"No fee cap. Fast processing.",url:"https://greatiowatreasurehunt.gov/"},
  {abbr:"KS",name:"Kansas",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.kansascash.com/"},
  {abbr:"KY",name:"Kentucky",feeCap:null,days:90,notes:"No fee cap.",url:"https://treasury.ky.gov/"},
  {abbr:"LA",name:"Louisiana",feeCap:null,days:120,notes:"No fee cap.",url:"https://www.latreasury.com/unclaimedproperty"},
  {abbr:"ME",name:"Maine",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.maine.gov/sto/"},
  {abbr:"MD",name:"Maryland",feeCap:null,days:90,notes:"No fee cap.",url:"https://interactive.marylandtaxes.gov/extranet/ucp/"},
  {abbr:"MA",name:"Massachusetts",feeCap:null,days:120,notes:"No fee cap. Large database.",url:"https://www.findmassmoney.com/"},
  {abbr:"MI",name:"Michigan",feeCap:null,days:90,notes:"No fee cap.",url:"https://michigan.findyourunclaimedproperty.com/"},
  {abbr:"MN",name:"Minnesota",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.mnunclaimedproperty.org/"},
  {abbr:"MS",name:"Mississippi",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.treasury.ms.gov/"},
  {abbr:"MO",name:"Missouri",feeCap:null,days:90,notes:"No fee cap.",url:"https://treasurer.mo.gov/UnclaimedProperty/"},
  {abbr:"MT",name:"Montana",feeCap:null,days:90,notes:"No fee cap.",url:"https://unclaimedproperty.mt.gov/"},
  {abbr:"NE",name:"Nebraska",feeCap:null,days:60,notes:"No fee cap. Fast.",url:"https://treasurer.nebraska.gov/up/"},
  {abbr:"NV",name:"Nevada",feeCap:null,days:90,notes:"No fee cap. Large casino/hospitality holdings.",url:"https://nevadaunclaimed.gov/"},
  {abbr:"NH",name:"New Hampshire",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.nhtreasurer.com/"},
  {abbr:"NJ",name:"New Jersey",feeCap:null,days:120,notes:"No fee cap. Large database.",url:"https://www.njproperty.com/"},
  {abbr:"NM",name:"New Mexico",feeCap:null,days:90,notes:"No fee cap.",url:"https://myunclaimedproperty.nm.gov/"},
  {abbr:"NY",name:"New York",feeCap:null,days:180,notes:"No fee cap. Largest database in US. Slow processing.",url:"https://www.osc.state.ny.us/unclaimed-funds"},
  {abbr:"NC",name:"North Carolina",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.nccash.com/"},
  {abbr:"ND",name:"North Dakota",feeCap:null,days:60,notes:"No fee cap.",url:"https://www.land.nd.gov/unclaimed-property"},
  {abbr:"OH",name:"Ohio",feeCap:null,days:90,notes:"No fee cap. Recovery-agent friendly.",url:"https://com.ohio.gov/divisions/unclaimed-funds"},
  {abbr:"OK",name:"Oklahoma",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.ok.gov/treasurer/"},
  {abbr:"OR",name:"Oregon",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.oregonunclaimedproperty.com/"},
  {abbr:"PA",name:"Pennsylvania",feeCap:null,days:120,notes:"No fee cap.",url:"https://www.patreasury.gov/unclaimed-property/"},
  {abbr:"RI",name:"Rhode Island",feeCap:null,days:90,notes:"No fee cap.",url:"https://treasury.ri.gov/unclaimed-property"},
  {abbr:"SC",name:"South Carolina",feeCap:null,days:90,notes:"No fee cap.",url:"https://treasurer.sc.gov/unclaimed-property"},
  {abbr:"SD",name:"South Dakota",feeCap:null,days:60,notes:"No fee cap. Fast.",url:"https://unclaimedproperty.sd.gov/"},
  {abbr:"TN",name:"Tennessee",feeCap:null,days:90,notes:"No fee cap.",url:"https://tn.findyourunclaimedproperty.com/"},
  {abbr:"TX",name:"Texas",feeCap:10,days:90,notes:"10% fee cap enforced. High volume state.",url:"https://claimittexas.org/"},
  {abbr:"UT",name:"Utah",feeCap:null,days:90,notes:"No fee cap.",url:"https://mycash.utah.gov/"},
  {abbr:"VT",name:"Vermont",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.vermonttreasurer.gov/unclaimed-property"},
  {abbr:"VA",name:"Virginia",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.vamoneysearch.org/"},
  {abbr:"WA",name:"Washington",feeCap:null,days:90,notes:"No fee cap.",url:"https://ucp.dor.wa.gov/"},
  {abbr:"WV",name:"West Virginia",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.wvsto.com/UnclaimedProperty"},
  {abbr:"WI",name:"Wisconsin",feeCap:null,days:90,notes:"No fee cap.",url:"https://www.moneysearch.wi.gov/"},
  {abbr:"WY",name:"Wyoming",feeCap:null,days:60,notes:"No fee cap. Fast.",url:"https://treasurer.wyo.gov/unclaimed-property"},
];

const SAMPLE_LEADS = [
  {
    id:"1", firstName:"Margaret", lastName:"Okonkwo",
    phone:"760-238-1042", email:"m.okonkwo@email.com",
    address:"1421 Birch Lane", city:"Fresno", state:"CA", zip:"93650",
    propertyType:"Bank Account", propertyValue:4200,
    propertyState:"CA", holdingEntity:"Fifth Third Bank", propertyId:"CA-2024-88431",
    stage:"contacted", feePercent:10,
    outreachLog:[
      {date:"2026-06-10",method:"Letter",notes:"Initial letter sent via PostGrid"},
      {date:"2026-06-18",method:"Phone",notes:"Spoke with Margaret — interested, sending agreement"}
    ],
    docs:{agreementSigned:false,idVerified:true,proofOfOwnership:false,claimSubmitted:false,paymentReceived:false},
    feeAmount:420, paidDate:null, source:"CA SCO Public Data File", leadDate:"2026-06-08",
    notes:"Very receptive. Forgot about this account from 2019.",
    activity:[
      {date:"2026-06-08",action:"Lead created"},
      {date:"2026-06-10",action:"Letter sent"},
      {date:"2026-06-18",action:"Stage → Contacted"}
    ],
    aiNotes:""
  },
  {
    id:"2", firstName:"James", lastName:"Whitfield",
    phone:"619-901-3371", email:"jwhitfield@email.com",
    address:"88 Maple Court", city:"San Diego", state:"CA", zip:"92109",
    propertyType:"Insurance Policy", propertyValue:12500,
    propertyState:"CA", holdingEntity:"State Farm", propertyId:"CA-2024-14290",
    stage:"signed", feePercent:10,
    outreachLog:[
      {date:"2026-05-20",method:"Letter",notes:"Initial letter"},
      {date:"2026-05-29",method:"Phone",notes:"Connected — deceased father's policy, very motivated"},
      {date:"2026-06-09",method:"DocuSign",notes:"Agreement returned signed"}
    ],
    docs:{agreementSigned:true,idVerified:true,proofOfOwnership:true,claimSubmitted:false,paymentReceived:false},
    feeAmount:1250, paidDate:null, source:"CA SCO Public Data File", leadDate:"2026-05-18",
    notes:"Heir claim — father's insurance. Has death cert.",
    activity:[
      {date:"2026-05-18",action:"Lead created"},
      {date:"2026-05-20",action:"Letter sent"},
      {date:"2026-05-29",action:"Stage → Contacted"},
      {date:"2026-06-05",action:"Stage → Agreement Sent"},
      {date:"2026-06-09",action:"Stage → Signed"}
    ],
    aiNotes:"James mentioned his father passed in 2021. Policy was from a prior employer. He has the death cert and is motivated to close fast."
  },
  {
    id:"3", firstName:"Rosa", lastName:"Delgado",
    phone:"916-673-2201", email:"rosad@gmail.com",
    address:"2900 Sunset Blvd", city:"Sacramento", state:"CA", zip:"95818",
    propertyType:"Wages / Payroll", propertyValue:890,
    propertyState:"CA", holdingEntity:"Former Employer LLC", propertyId:"CA-2024-33001",
    stage:"fee_collected", feePercent:10,
    outreachLog:[
      {date:"2026-04-12",method:"Letter",notes:"Initial letter"},
      {date:"2026-04-20",method:"Phone",notes:"Connected quickly, agreed same day"}
    ],
    docs:{agreementSigned:true,idVerified:true,proofOfOwnership:true,claimSubmitted:true,paymentReceived:true},
    feeAmount:89, paidDate:"2026-06-01", source:"CA SCO Public Data File", leadDate:"2026-04-10",
    notes:"Fastest close to date — 52 days total.",
    activity:[
      {date:"2026-04-10",action:"Lead created"},
      {date:"2026-04-12",action:"Letter sent"},
      {date:"2026-04-20",action:"Stage → Contacted"},
      {date:"2026-04-22",action:"Stage → Signed"},
      {date:"2026-04-25",action:"Stage → Claim Filed"},
      {date:"2026-05-20",action:"Stage → Payout Confirmed"},
      {date:"2026-06-01",action:"Stage → Fee Collected — $89 received"}
    ],
    aiNotes:""
  },
  {
    id:"4", firstName:"David", lastName:"Chen",
    phone:"858-412-0088", email:"dchen@outlook.com",
    address:"504 Pine Street", city:"Carlsbad", state:"CA", zip:"92008",
    propertyType:"Stocks / Securities", propertyValue:31200,
    propertyState:"CA", holdingEntity:"Charles Schwab", propertyId:"CA-2024-05512",
    stage:"lead", feePercent:10,
    outreachLog:[],
    docs:{agreementSigned:false,idVerified:false,proofOfOwnership:false,claimSubmitted:false,paymentReceived:false},
    feeAmount:3120, paidDate:null, source:"CA SCO Public Data File", leadDate:"2026-06-22",
    notes:"High value. Stock account from former employer ESPP.",
    activity:[
      {date:"2026-06-22",action:"Lead created"}
    ],
    aiNotes:""
  }
];

const fmt = (n) => "$" + Number(n||0).toLocaleString();
const stageOf = (id) => STAGES.find(s => s.id === id) || STAGES[0];
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);

// California caps investigator/locator fees at 10% (CCP § 1582). This is a hard
// ceiling enforced everywhere a fee can be set — there is no override in the UI.
const CA_FEE_CAP = 10;
const capFee = (p) => Math.min(Math.max(Number(p) || 0, 0), CA_FEE_CAP);
const feeAmountFor = (value, pct) => Math.round((Number(value)||0) * capFee(pct) / 100);

// ── StageBadge ────────────────────────────────────────────────────────────
function StageBadge({stageId, small}) {
  const s = stageOf(stageId);
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", padding: small ? "2px 8px" : "3px 10px",
      borderRadius:20, fontSize: small ? 11 : 12, fontWeight:600,
      color:s.color, background:s.bg, whiteSpace:"nowrap"
    }}>{s.label}</span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({leads, onSelect}) {
  const collected = leads.filter(l => l.stage === "fee_collected");
  const active = leads.filter(l => !["fee_collected","closed_lost"].includes(l.stage));
  const totalRecovered = collected.reduce((s,l) => s+(l.feeAmount||0),0);
  const pipeline = active.reduce((s,l) => s+(l.feeAmount||0),0);
  const inFlight = leads.filter(l => l.stage === "claim_filed").length;
  const recent = [...leads].sort((a,b) => (b.activity?.slice(-1)[0]?.date||"") > (a.activity?.slice(-1)[0]?.date||"") ? 1 : -1).slice(0,5);

  const stageCounts = STAGES.map(s => ({...s, count: leads.filter(l => l.stage === s.id).length}));

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'DM Serif Display',serif", fontSize:28, fontWeight:700, margin:0}}>Overview</h1>
        <p style={{color:"var(--slate)", margin:"4px 0 0", fontSize:14}}>{new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16, marginBottom:24}}>
        {[
          {label:"Total Recovered", value:fmt(totalRecovered), sub:`${collected.length} deals closed`, accent:true},
          {label:"Pipeline Value", value:fmt(pipeline), sub:`${active.length} active leads`},
          {label:"Claims In Flight", value:inFlight, sub:"awaiting state decision"},
          {label:"Total Leads", value:leads.length, sub:"all time"},
        ].map((k,i) => (
          <div key={i} style={{
            background: k.accent ? "var(--navy-deep)" : "var(--surface)",
            color: k.accent ? "var(--surface)" : "var(--ink)",
            border:"1px solid var(--border)", borderRadius:12, padding:"20px 24px"
          }}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",opacity:.7,marginBottom:6}}>{k.label}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:34,fontWeight:700,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:12,opacity:.6,marginTop:4}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:16}}>
        {/* Pipeline breakdown */}
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,fontWeight:700,marginBottom:16}}>Pipeline Breakdown</div>
          {stageCounts.filter(s => s.id !== "closed_lost").map(s => (
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}} />
              <span style={{fontSize:13,flex:1}}>{s.label}</span>
              <span style={{fontWeight:700,fontSize:13}}>{s.count}</span>
              <div style={{width:80,height:6,background:"var(--divider)",borderRadius:4,overflow:"hidden"}}>
                <div style={{width:`${leads.length ? (s.count/leads.length*100) : 0}%`,height:"100%",background:s.color,borderRadius:4}} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,fontWeight:700,marginBottom:16}}>Recent Activity</div>
          {recent.map(lead => (
            <div key={lead.id} onClick={() => onSelect(lead)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--divider)",cursor:"pointer"}}
            >
              <div style={{width:36,height:36,borderRadius:10,background:"var(--accent-soft)",display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"'DM Serif Display',serif",fontWeight:700,fontSize:14,color:"var(--navy)",flexShrink:0}}>
                {lead.firstName[0]}{lead.lastName[0]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13}}>{lead.firstName} {lead.lastName}</div>
                <div style={{fontSize:12,color:"var(--slate)"}}>{lead.activity?.slice(-1)[0]?.action}</div>
              </div>
              <StageBadge stageId={lead.stage} small />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Leads Tab ─────────────────────────────────────────────────────────────
function LeadsTab({leads, stageFilter, setStageFilter, onSelect}) {
  const [search, setSearch] = useState("");
  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || `${l.firstName} ${l.lastName} ${l.propertyState} ${l.propertyType}`.toLowerCase().includes(q);
    const matchS = stageFilter === "all" || l.stage === stageFilter;
    return matchQ && matchS;
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,fontWeight:700,margin:0,flex:1}}>Leads</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
          style={{padding:"9px 14px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,width:220,outline:"none"}} />
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          style={{padding:"9px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,background:"var(--surface)",outline:"none"}}>
          <option value="all">All Stages</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 130px 110px 110px 90px",minWidth:600,gap:12,padding:"10px 16px",
          borderBottom:"1px solid var(--border)",fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".06em"}}>
          <span>Claimant</span><span>Property Type</span><span>Value</span><span>Est. Fee</span><span>Stage</span>
        </div>
        {filtered.map(lead => (
          <div key={lead.id} onClick={() => onSelect(lead)}
            style={{display:"grid",gridTemplateColumns:"1fr 130px 110px 110px 90px",minWidth:600,gap:12,padding:"12px 16px",
              borderBottom:"1px solid var(--divider)",cursor:"pointer",alignItems:"center",transition:"background .1s"}}
            onMouseEnter={e => e.currentTarget.style.background="var(--cream)"}
            onMouseLeave={e => e.currentTarget.style.background=""}
          >
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{lead.firstName} {lead.lastName}</div>
              <div style={{fontSize:12,color:"var(--slate)"}}>{lead.propertyState} · {lead.holdingEntity}</div>
            </div>
            <div style={{fontSize:13}}>{lead.propertyType}</div>
            <div style={{fontWeight:600,fontSize:13}}>{fmt(lead.propertyValue)}</div>
            <div style={{fontWeight:600,fontSize:13,color:"var(--navy)"}}>{fmt(lead.feeAmount)}</div>
            <StageBadge stageId={lead.stage} small />
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{padding:40,textAlign:"center",color:"var(--slate)",fontSize:14}}>No leads match your filters.</div>
        )}
      </div>
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────
function PipelineTab({leads, onSelect, onMove}) {
  const active = STAGES.filter(s => s.id !== "closed_lost");
  return (
    <div>
      <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,fontWeight:700,margin:"0 0 20px"}}>Pipeline</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        {active.map(stage => {
          const cards = leads.filter(l => l.stage === stage.id);
          return (
            <div key={stage.id} style={{background:"var(--panel-2)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:stage.color}} />
                <span style={{fontWeight:700,fontSize:12,color:stage.color}}>{stage.label}</span>
                <span style={{marginLeft:"auto",background:"var(--surface)",border:"1px solid var(--border)",
                  borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700,color:"var(--slate)"}}>{cards.length}</span>
              </div>
              <div style={{padding:10,display:"flex",flexDirection:"column",gap:8,minHeight:120}}>
                {cards.map(lead => (
                  <div key={lead.id} onClick={() => onSelect(lead)}
                    style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",cursor:"pointer"}}
                    onMouseEnter={e => e.currentTarget.style.borderColor="var(--navy)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                  >
                    <div style={{fontWeight:600,fontSize:13}}>{lead.firstName} {lead.lastName}</div>
                    <div style={{fontSize:11,color:"var(--slate)",margin:"2px 0"}}>{lead.propertyType} · {lead.propertyState}</div>
                    <div style={{fontWeight:700,fontSize:13,color:"var(--navy)"}}>{fmt(lead.feeAmount)}</div>
                    <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
                      {STAGES.filter(s => s.id !== stage.id && s.id !== "closed_lost").slice(0,3).map(s => (
                        <button key={s.id} onClick={e => {e.stopPropagation(); onMove(lead, s.id);}}
                          style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:"1px solid "+s.color,
                            color:s.color,background:"transparent",cursor:"pointer"}}>
                          → {s.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── States Tab ────────────────────────────────────────────────────────────
function StatesTab() {
  const [search, setSearch] = useState("");
  const [capFilter, setCapFilter] = useState("all");
  const filtered = US_STATES.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.abbr.toLowerCase().includes(q);
    const matchCap = capFilter === "all" || (capFilter === "cap" ? s.feeCap !== null : s.feeCap === null);
    return matchQ && matchCap;
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,fontWeight:700,margin:0,flex:1}}>State Reference</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search states…"
          style={{padding:"9px 14px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,width:200,outline:"none"}} />
        <select value={capFilter} onChange={e => setCapFilter(e.target.value)}
          style={{padding:"9px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,background:"var(--surface)",outline:"none"}}>
          <option value="all">All States</option>
          <option value="nocap">No Fee Cap</option>
          <option value="cap">Has Fee Cap</option>
        </select>
      </div>

      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr 80px 100px 1fr",minWidth:600,gap:12,padding:"10px 16px",
          borderBottom:"1px solid var(--border)",fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".06em"}}>
          <span>State</span><span>Name</span><span>Fee Cap</span><span>Avg Days</span><span>Notes</span>
        </div>
        {filtered.map(s => (
          <div key={s.abbr} style={{display:"grid",gridTemplateColumns:"60px 1fr 80px 100px 1fr",minWidth:600,gap:12,
            padding:"12px 16px",borderBottom:"1px solid var(--divider)",alignItems:"center",fontSize:13}}>
            <div style={{fontWeight:800,fontFamily:"'DM Serif Display',serif",fontSize:16,color:"var(--navy)"}}>{s.abbr}</div>
            <div style={{fontWeight:600}}>{s.name}</div>
            <div>
              {s.feeCap ?
                <span style={{background:"var(--warn-bg)",color:"var(--warn)",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{s.feeCap}% cap</span>
                : <span style={{background:"var(--ok-bg)",color:"var(--ok)",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>None</span>
              }
            </div>
            <div style={{color:"var(--slate)"}}>{s.days} days</div>
            <div style={{color:"var(--slate-2)",fontSize:12}}>{s.notes} {" "}
              <a href={s.url} target="_blank" rel="noreferrer"
                style={{color:"var(--navy)",textDecoration:"none",fontWeight:600}}>Visit ↗</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Revenue Tab ───────────────────────────────────────────────────────────
function RevenueTab({leads}) {
  const collected = leads.filter(l => l.stage === "fee_collected" && l.paidDate);
  const totalFees = collected.reduce((s,l) => s+(l.feeAmount||0),0);
  const totalValue = collected.reduce((s,l) => s+(l.propertyValue||0),0);
  const pipeline = leads.filter(l => !["fee_collected","closed_lost"].includes(l.stage)).reduce((s,l) => s+(l.feeAmount||0),0);

  const byState = {};
  collected.forEach(l => {
    byState[l.propertyState] = (byState[l.propertyState]||0) + (l.feeAmount||0);
  });

  return (
    <div>
      <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,fontWeight:700,margin:"0 0 20px"}}>Revenue</h1>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:24}}>
        {[
          {label:"Total Fees Collected",value:fmt(totalFees),sub:"all time"},
          {label:"Total Value Recovered",value:fmt(totalValue),sub:"for clients"},
          {label:"Pipeline Fees",value:fmt(pipeline),sub:"projected"},
        ].map((k,i) => (
          <div key={i} style={{background:i===0?"var(--navy-deep)":"var(--surface)",color:i===0?"var(--surface)":"var(--ink)",
            border:"1px solid var(--border)",borderRadius:12,padding:"20px 24px"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",opacity:.7,marginBottom:6}}>{k.label}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:34,fontWeight:700,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:12,opacity:.6,marginTop:4}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:16}}>
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,fontWeight:700,marginBottom:16}}>Collected Deals</div>
          {collected.length === 0 && <div style={{color:"var(--slate)",fontSize:14}}>No collected deals yet.</div>}
          {collected.map(l => (
            <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--divider)"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{l.firstName} {l.lastName}</div>
                <div style={{fontSize:12,color:"var(--slate)"}}>{l.propertyType} · {l.propertyState} · {l.paidDate}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:"var(--navy)"}}>{fmt(l.feeAmount)}</div>
                <div style={{fontSize:11,color:"var(--slate)"}}>{l.feePercent}% of {fmt(l.propertyValue)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,fontWeight:700,marginBottom:16}}>By State</div>
          {Object.entries(byState).sort((a,b) => b[1]-a[1]).map(([st,amt]) => (
            <div key={st} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--divider)",fontSize:13}}>
              <span style={{fontWeight:700,color:"var(--navy)"}}>{st}</span>
              <span style={{fontWeight:600}}>{fmt(amt)}</span>
            </div>
          ))}
          {Object.keys(byState).length === 0 && <div style={{color:"var(--slate)",fontSize:14}}>No data yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Letters Tab ───────────────────────────────────────────────────────────
function LettersTab({leads}) {
  const needsLetter = leads.filter(l => l.stage === "lead");
  const sent = leads.filter(l => l.stage !== "lead" && l.outreachLog?.some(o => o.method === "Letter"));

  const genLetter = (lead) => {
    const fee = lead.feePercent || 30;
    return `[Your Name / Company Name]
[Address]
[City, State ZIP]
[Date]

${lead.firstName} ${lead.lastName}
${lead.address}
${lead.city}, ${lead.state} ${lead.zip}

Dear ${lead.firstName},

I'm reaching out because I believe the state of ${lead.propertyState} may be holding unclaimed funds in your name — specifically a ${lead.propertyType.toLowerCase()} currently listed under ${lead.holdingEntity || "a prior holder"}.

Many people are unaware that unclaimed funds are transferred to the state after a period of inactivity. These funds don't disappear — they wait until the rightful owner comes forward.

Here's how this works: I locate the funds, handle all paperwork, and submit the claim on your behalf. There is no upfront cost. My fee is ${fee}% of whatever is successfully recovered, paid only after you receive your funds.

If you'd like to learn more or get started, please call or text me at [Your Phone Number]. I'm happy to answer any questions.

Sincerely,
[Your Name]
[Your Phone] | [Your Email]`;
  };

  const [selected, setSelected] = useState(null);

  return (
    <div>
      <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,fontWeight:700,margin:"0 0 20px"}}>Letters</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:16,alignItems:"start"}}>
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,overflowX:"auto"}}>
          <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",fontSize:12,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".06em"}}>
            Ready to Send ({needsLetter.length})
          </div>
          {needsLetter.map(l => (
            <div key={l.id} onClick={() => setSelected(l)}
              style={{padding:"12px 14px",borderBottom:"1px solid var(--divider)",cursor:"pointer",
                background: selected?.id === l.id ? "var(--accent-soft)" : ""}}
              onMouseEnter={e => { if(selected?.id !== l.id) e.currentTarget.style.background="var(--cream)"; }}
              onMouseLeave={e => { if(selected?.id !== l.id) e.currentTarget.style.background=""; }}
            >
              <div style={{fontWeight:600,fontSize:13}}>{l.firstName} {l.lastName}</div>
              <div style={{fontSize:12,color:"var(--slate)"}}>{l.propertyType} · {l.propertyState}</div>
            </div>
          ))}
          {needsLetter.length === 0 && <div style={{padding:20,color:"var(--slate)",fontSize:13}}>All leads have been contacted.</div>}
          {sent.length > 0 && (
            <>
              <div style={{padding:"12px 14px",borderTop:"1px solid var(--border)",borderBottom:"1px solid var(--border)",
                fontSize:12,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".06em"}}>
                Sent ({sent.length})
              </div>
              {sent.map(l => (
                <div key={l.id} onClick={() => setSelected(l)}
                  style={{padding:"12px 14px",borderBottom:"1px solid var(--divider)",cursor:"pointer",opacity:.7,
                    background: selected?.id === l.id ? "var(--accent-soft)" : ""}}
                  onMouseEnter={e => { if(selected?.id !== l.id) e.currentTarget.style.background="var(--cream)"; }}
                  onMouseLeave={e => { if(selected?.id !== l.id) e.currentTarget.style.background=""; }}
                >
                  <div style={{fontWeight:600,fontSize:13}}>{l.firstName} {l.lastName}</div>
                  <div style={{fontSize:12,color:"var(--slate)"}}>{l.propertyType} · {l.propertyState}</div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
          {selected ? (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,fontWeight:700}}>
                  Letter for {selected.firstName} {selected.lastName}
                </div>
                <button className="btn-primary" onClick={() => {
                  navigator.clipboard.writeText(genLetter(selected));
                  alert("Copied to clipboard!");
                }}>Copy Letter</button>
              </div>
              <pre style={{fontFamily:"Georgia, serif",fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",
                background:"var(--cream)",padding:20,borderRadius:8,border:"1px solid var(--border)",margin:0}}>
                {genLetter(selected)}
              </pre>
            </>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:"var(--slate)",fontSize:14}}>
              Select a lead to preview their letter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lead Drawer ───────────────────────────────────────────────────────────
function LeadDrawer({lead, drawerTab, setDrawerTab, onClose, onSave, onMove}) {
  const [form, setForm] = useState(lead);
  const [aiLoading, setAiLoading] = useState(false);
  const [callText, setCallText] = useState("");
  const [newOutreach, setNewOutreach] = useState({method:"Phone",notes:""});

  useEffect(() => { setForm(lead); }, [lead]);

  const patch = (obj) => setForm(f => ({...f,...obj}));
  const patchDoc = (key) => setForm(f => ({...f, docs:{...f.docs,[key]:!f.docs[key]}}));

  const saveAndLog = () => {
    const updated = {
      ...form,
      activity:[...(form.activity||[]), {date:today(), action:"Lead details updated"}]
    };
    onSave(updated);
  };

  const addOutreach = () => {
    if(!newOutreach.notes.trim()) return;
    const updated = {
      ...form,
      outreachLog:[...(form.outreachLog||[]),{date:today(),...newOutreach}],
      activity:[...(form.activity||[]),{date:today(),action:`Outreach logged: ${newOutreach.method}`}]
    };
    setForm(updated);
    onSave(updated);
    setNewOutreach({method:"Phone",notes:""});
  };

  const processAiNotes = async () => {
    if(!callText.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:800,
          system:`You are a recovery agent assistant. Summarize call notes into: key facts, action items, and tone/sentiment. Keep it concise and structured. Claimant: ${form.firstName} ${form.lastName}, property: ${form.propertyType} in ${form.propertyState} worth ${fmt(form.propertyValue)}.`,
          messages:[{role:"user",content:`Call notes to process:\n\n${callText}`}]
        })
      });
      const data = await res.json();
      const summary = data.content?.[0]?.text || "";
      const updated = {...form, aiNotes: summary,
        activity:[...(form.activity||[]),{date:today(),action:"AI call notes processed"}]};
      setForm(updated);
      onSave(updated);
      setCallText("");
    } catch(e) { alert("API error: "+e.message); }
    finally { setAiLoading(false); }
  };

  const drawerTabs = ["details","outreach","financials","documents","activity","ai notes"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"stretch"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,.35)",backdropFilter:"blur(2px)"}} />
      <div style={{width:520,background:"var(--surface)",overflowY:"auto",display:"flex",flexDirection:"column",boxShadow:"-8px 0 32px rgba(0,0,0,.12)"}}>
        {/* Drawer header */}
        <div style={{padding:"20px 24px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,fontWeight:700}}>
              {form.firstName} {form.lastName}
            </div>
            <div style={{fontSize:13,color:"var(--slate)",marginTop:2}}>{form.propertyType} · {form.propertyState} · {fmt(form.propertyValue)}</div>
            <div style={{marginTop:8}}>
              <select value={form.stage} onChange={e => { const updated={...form,stage:e.target.value,activity:[...(form.activity||[]),{date:today(),action:"Stage → "+STAGES.find(s=>s.id===e.target.value)?.label}]}; setForm(updated); onMove(updated,e.target.value); }}
                style={{padding:"4px 8px",border:"1px solid var(--border)",borderRadius:6,fontSize:12,fontWeight:600,
                  color:stageOf(form.stage).color,background:stageOf(form.stage).bg,cursor:"pointer",outline:"none"}}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:"var(--slate)",padding:4,lineHeight:1}}>✕</button>
        </div>

        {/* Drawer nav */}
        <div style={{display:"flex",borderBottom:"1px solid var(--border)",overflowX:"auto",padding:"0 12px"}}>
          {drawerTabs.map(t => (
            <button key={t} onClick={() => setDrawerTab(t)}
              style={{background:"none",border:"none",borderBottom:`2px solid ${drawerTab===t?"var(--navy)":"transparent"}`,
                padding:"10px 12px",fontSize:12,fontWeight:drawerTab===t?700:500,
                color:drawerTab===t?"var(--navy)":"var(--slate)",whiteSpace:"nowrap",cursor:"pointer",textTransform:"capitalize"}}>
              {t}
            </button>
          ))}
        </div>

        <div style={{padding:24,flex:1}}>
          {/* DETAILS */}
          {drawerTab==="details" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:4}}>Claimant</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:12}}>
                {[["First Name","firstName"],["Last Name","lastName"],["Phone","phone"],["Email","email"]].map(([lbl,key]) => (
                  <div key={key} style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>{lbl}</label>
                    <input value={form[key]||""} onChange={e => patch({[key]:e.target.value})}
                      style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,110px),1fr))",gap:12}}>
                {[["Address","address"],["City","city"],["ZIP","zip"]].map(([lbl,key]) => (
                  <div key={key} style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>{lbl}</label>
                    <input value={form[key]||""} onChange={e => patch({[key]:e.target.value})}
                      style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
                  </div>
                ))}
              </div>

              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",margin:"8px 0 4px"}}>Property</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:12}}>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Type</label>
                  <select value={form.propertyType||""} onChange={e => patch({propertyType:e.target.value})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",background:"var(--surface)"}}>
                    {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Holding State</label>
                  <select value={form.propertyState||""} onChange={e => patch({propertyState:e.target.value})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",background:"var(--surface)"}}>
                    {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Property Value ($)</label>
                  <input type="number" value={form.propertyValue||""} onChange={e => patch({propertyValue:Number(e.target.value),feeAmount:feeAmountFor(Number(e.target.value), form.feePercent)})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Holding Entity</label>
                  <input value={form.holdingEntity||""} onChange={e => patch({holdingEntity:e.target.value})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>State Property ID</label>
                  <input value={form.propertyId||""} onChange={e => patch({propertyId:e.target.value})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Lead Source</label>
                  <select value={form.source||""} onChange={e => patch({source:e.target.value})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",background:"var(--surface)"}}>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Notes</label>
                <textarea value={form.notes||""} onChange={e => patch({notes:e.target.value})} rows={3}
                  style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",resize:"vertical"}} />
              </div>

              <button onClick={saveAndLog} style={{background:"var(--navy)",color:"var(--surface)",border:"none",padding:"10px 20px",
                borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",marginTop:4}}>Save Changes</button>
            </div>
          )}

          {/* OUTREACH */}
          {drawerTab==="outreach" && (
            <div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:16}}>Outreach Log</div>
              {(form.outreachLog||[]).map((o,i) => (
                <div key={i} style={{padding:"12px 0",borderBottom:"1px solid var(--divider)"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:12,background:"var(--accent-soft)",color:"var(--navy)",padding:"2px 8px",borderRadius:20}}>{o.method}</span>
                    <span style={{fontSize:12,color:"var(--slate)"}}>{o.date}</span>
                  </div>
                  <div style={{fontSize:13}}>{o.notes}</div>
                </div>
              ))}
              {(form.outreachLog||[]).length === 0 && <div style={{color:"var(--slate)",fontSize:13,marginBottom:16}}>No outreach logged yet.</div>}

              <div style={{marginTop:20,padding:16,background:"var(--panel)",borderRadius:10}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Log New Contact</div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <select value={newOutreach.method} onChange={e => setNewOutreach(n => ({...n,method:e.target.value}))}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,background:"var(--surface)",outline:"none",flex:1}}>
                    {["Phone","Letter","Email","DocuSign","Text","In Person"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <textarea value={newOutreach.notes} onChange={e => setNewOutreach(n => ({...n,notes:e.target.value}))}
                  placeholder="What happened?" rows={3}
                  style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",resize:"vertical",marginBottom:8}} />
                <button onClick={addOutreach} style={{background:"var(--navy)",color:"var(--surface)",border:"none",padding:"8px 16px",
                  borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer"}}>Log Contact</button>
              </div>
            </div>
          )}

          {/* FINANCIALS */}
          {drawerTab==="financials" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:4}}>Fee Structure</div>
              <div style={{background:"var(--navy-deep)",color:"var(--surface)",borderRadius:10,padding:20,marginBottom:8}}>
                <div style={{fontSize:11,opacity:.7,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Estimated Fee</div>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:40,fontWeight:700,lineHeight:1}}>{fmt(feeAmountFor(form.propertyValue, CA_FEE_CAP))}</div>
                <div style={{fontSize:12,opacity:.6,marginTop:4}}>{CA_FEE_CAP}% of {fmt(form.propertyValue)}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:12}}>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Fee %</label>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,background:"var(--panel)"}}>
                    <span style={{fontWeight:700,color:"var(--navy)"}}>{CA_FEE_CAP}%</span>
                    <span style={{fontSize:11,color:"var(--slate)"}}>🔒 locked (CCP § 1582)</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Date Paid</label>
                  <input type="date" value={form.paidDate||""} onChange={e => patch({paidDate:e.target.value})}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
                </div>
              </div>
              <div style={{background:"var(--gold-tint)",border:"1px solid var(--gold-border)",borderRadius:8,padding:12,fontSize:13,color:"var(--slate-2)"}}>
                California caps investigator/locator fees at <strong>{CA_FEE_CAP}%</strong> of recovered property under
                <strong> Code of Civil Procedure § 1582</strong>. This ceiling is enforced and cannot be raised in the app.
              </div>
              <button onClick={() => { patch({feePercent:CA_FEE_CAP, feeAmount:feeAmountFor(form.propertyValue, CA_FEE_CAP)}); saveAndLog(); }}
                style={{background:"var(--navy)",color:"var(--surface)",border:"none",padding:"10px 20px",
                borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>Save</button>
            </div>
          )}

          {/* DOCUMENTS */}
          {drawerTab==="documents" && (
            <div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:16}}>Document Checklist</div>
              {[
                {key:"agreementSigned",label:"Contingency Agreement Signed",desc:"Client has signed your fee agreement"},
                {key:"idVerified",label:"ID Verified",desc:"Government-issued ID confirmed"},
                {key:"proofOfOwnership",label:"Proof of Ownership",desc:"Prior address, account docs, or affidavit"},
                {key:"claimSubmitted",label:"Claim Submitted to State",desc:"Official claim form filed with state treasury"},
                {key:"paymentReceived",label:"Payment Received",desc:"Funds recovered and fee collected"},
              ].map(({key,label,desc}) => (
                <div key={key} onClick={() => { const u={...form,docs:{...form.docs,[key]:!form.docs[key]},activity:[...(form.activity||[]),{date:today(),action:(form.docs[key]?"Unchecked":"Checked")+": "+label}]}; setForm(u); onSave(u); }}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid var(--divider)",cursor:"pointer"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${form.docs?.[key]?"var(--navy)":"var(--doc-idle)"}`,
                    background:form.docs?.[key]?"var(--navy)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {form.docs?.[key] && <span style={{color:"var(--surface)",fontSize:12}}>✓</span>}
                  </div>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:form.docs?.[key]?"var(--navy)":"var(--ink)",textDecoration:form.docs?.[key]?"line-through":"none"}}>{label}</div>
                    <div style={{fontSize:11,color:"var(--slate)"}}>{desc}</div>
                  </div>
                </div>
              ))}
              <div style={{marginTop:16,padding:12,background:"var(--panel)",borderRadius:8,fontSize:12,color:"var(--slate-2)"}}>
                {Object.values(form.docs||{}).filter(Boolean).length} of 5 complete
              </div>
            </div>
          )}

          {/* ACTIVITY */}
          {drawerTab==="activity" && (
            <div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:16}}>Activity Log</div>
              {[...(form.activity||[])].reverse().map((a,i) => (
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid var(--divider)"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"var(--navy)",flexShrink:0,marginTop:5}} />
                  <div>
                    <div style={{fontSize:13}}>{a.action}</div>
                    <div style={{fontSize:11,color:"var(--slate)"}}>{a.date}</div>
                  </div>
                </div>
              ))}
              {(form.activity||[]).length === 0 && <div style={{color:"var(--slate)",fontSize:13}}>No activity yet.</div>}
            </div>
          )}

          {/* AI NOTES */}
          {drawerTab==="ai notes" && (
            <div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:4}}>AI Call Notes</div>
              <p style={{fontSize:13,color:"var(--slate)",marginTop:0,marginBottom:16}}>Paste raw call notes below. Claude will extract key facts, action items, and sentiment.</p>
              {form.aiNotes && (
                <div style={{background:"var(--accent-soft)",border:"1px solid var(--gold-border)",borderRadius:8,padding:14,marginBottom:16,fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>
                  {form.aiNotes}
                </div>
              )}
              <textarea value={callText} onChange={e => setCallText(e.target.value)}
                placeholder="Paste raw call notes here…" rows={6}
                style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,outline:"none",resize:"vertical",marginBottom:10}} />
              <button onClick={processAiNotes} disabled={aiLoading||!callText.trim()}
                style={{background:aiLoading||!callText.trim()?"var(--disabled)":"var(--navy)",color:"var(--surface)",border:"none",
                  padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:aiLoading?"not-allowed":"pointer"}}>
                {aiLoading ? "Processing…" : "Process with Claude"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── New Lead Modal ────────────────────────────────────────────────────────
function NewLeadModal({onClose, onSave}) {
  const blank = {
    id:newId(), firstName:"", lastName:"", phone:"", email:"",
    address:"", city:"", state:"", zip:"",
    propertyType:"Bank Account", propertyValue:"", propertyState:"CA",
    holdingEntity:"", propertyId:"", stage:"lead", feePercent:CA_FEE_CAP,
    outreachLog:[], docs:{agreementSigned:false,idVerified:false,proofOfOwnership:false,claimSubmitted:false,paymentReceived:false},
    feeAmount:0, paidDate:null, source:"CA SCO Public Data File", leadDate:today(),
    notes:"", activity:[{date:today(),action:"Lead created"}], aiNotes:""
  };
  const [form, setForm] = useState(blank);
  const patch = (obj) => setForm(f => {
    const n = {...f,...obj};
    if(obj.feePercent !== undefined) n.feePercent = capFee(n.feePercent);   // hard cap — CCP § 1582
    if(obj.propertyValue !== undefined || obj.feePercent !== undefined)
      n.feeAmount = feeAmountFor(n.propertyValue, n.feePercent);
    return n;
  });

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--overlay)"}}>
      <div style={{background:"var(--surface)",borderRadius:16,width:560,maxHeight:"90vh",overflowY:"auto",padding:28,boxShadow:"0 24px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,fontWeight:700}}>New Lead</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:"var(--slate)",cursor:"pointer"}}>✕</button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontWeight:700,fontSize:12,color:"var(--navy)",textTransform:"uppercase",letterSpacing:".06em"}}>Claimant</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:10}}>
            {[["First Name","firstName"],["Last Name","lastName"],["Phone","phone"],["Email","email"]].map(([l,k]) => (
              <div key={k} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>{l}</label>
                <input value={form[k]||""} onChange={e => patch({[k]:e.target.value})}
                  style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,110px),1fr))",gap:10}}>
            {[["Address","address"],["City","city"],["ZIP","zip"]].map(([l,k]) => (
              <div key={k} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>{l}</label>
                <input value={form[k]||""} onChange={e => patch({[k]:e.target.value})}
                  style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
              </div>
            ))}
          </div>

          <div style={{fontWeight:700,fontSize:12,color:"var(--navy)",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>Property</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))",gap:10}}>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Type</label>
              <select value={form.propertyType} onChange={e => patch({propertyType:e.target.value})}
                style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",background:"var(--surface)"}}>
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Holding State</label>
              <select value={form.propertyState} onChange={e => patch({propertyState:e.target.value})}
                style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",background:"var(--surface)"}}>
                {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Value ($)</label>
              <input type="number" value={form.propertyValue||""} onChange={e => patch({propertyValue:Number(e.target.value)})}
                style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Fee % (max {CA_FEE_CAP})</label>
              <input type="number" min="0" max={CA_FEE_CAP} value={form.feePercent}
                onChange={e => patch({feePercent:Number(e.target.value)})}
                style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Holding Entity</label>
              <input value={form.holdingEntity||""} onChange={e => patch({holdingEntity:e.target.value})}
                style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none"}} />
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--slate)",textTransform:"uppercase",letterSpacing:".05em"}}>Source</label>
              <select value={form.source} onChange={e => patch({source:e.target.value})}
                style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,outline:"none",background:"var(--surface)"}}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {form.feeAmount > 0 && (
            <div style={{background:"var(--accent-soft)",borderRadius:8,padding:12,fontSize:13,fontWeight:600,color:"var(--navy)"}}>
              Estimated fee: {fmt(form.feeAmount)}
            </div>
          )}

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",padding:"10px 18px",borderRadius:8,fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={() => { if(!form.firstName||!form.lastName) return alert("First and last name required."); onSave(form); }}
              style={{background:"var(--navy)",color:"var(--surface)",border:"none",padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Create Lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── App Shell (root component) ─────────────────────────────────────────────
const TABS = [
  { id:"dashboard", label:"Dashboard" },
  { id:"leads",     label:"Leads" },
  { id:"pipeline",  label:"Pipeline" },
  { id:"states",    label:"States" },
  { id:"revenue",   label:"Revenue" },
  { id:"letters",   label:"Letters" },
];

// Brand palette lives here + as matching literals in the components above.
// To match Reclaim GA exactly, drop GA's hex values into these tokens.
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');

/* ============================================================================
   RECLAIM DESIGN TOKENS — single source of truth for the whole app.
   Reclaim is the parent brand; each state (CA, GA, …) is a DBA. To theme a new
   state arm, copy this :root block and change the BRAND values below — stage
   and status colors that alias to brand tokens update automatically.
   ============================================================================ */
:root {
  /* ── Brand / neutrals ── */
  --cream:       #FBF7EF;   /* page background */
  --surface:     #FFFFFF;   /* cards, drawers, modals */
  --panel:       #F4ECDB;   /* tinted panels */
  --panel-2:     #F8F1E3;   /* pipeline columns */
  --divider:     #EFE7D6;
  --border:      #E7DECB;
  --ink:         #1B2A3A;   /* primary text */
  --slate:       #7C8794;   /* muted labels */
  --slate-2:     #5C6675;
  --navy:        #1E3A5F;   /* primary brand */
  --navy-deep:   #16304C;   /* header + deep accents */
  --gold:        #B48A3C;   /* accent */
  --gold-soft:   #D9B863;   /* wordmark accent */
  --gold-tint:   #F6EDD6;   /* gold background wash */
  --gold-border: #E3D3A8;
  --accent-soft: #F3E9CF;   /* avatars, selected rows */
  --disabled:    #B9C0C9;
  --doc-idle:    #D7CCB6;
  --overlay:     rgba(0,0,0,.5);  /* modal scrim */

  /* ── Status ── */
  --warn: #EA580C;  --warn-bg: #FFF7ED;
  --ok:   #16A34A;  --ok-bg:   #F0FDF4;

  /* ── Pipeline stages (aliased to brand tokens where the value matches) ── */
  --stage-lead-fg:      var(--slate);   --stage-lead-bg:      var(--divider);
  --stage-contacted-fg: #2F6DB0;        --stage-contacted-bg: #EAF1F8;
  --stage-agreement-fg: var(--gold);    --stage-agreement-bg: var(--gold-tint);
  --stage-signed-fg:    var(--navy);    --stage-signed-bg:    #E7EDF4;
  --stage-filed-fg:     #7A5CB0;        --stage-filed-bg:     #F0EBF8;
  --stage-payout-fg:    #0D8A6A;        --stage-payout-bg:    #E6F5EF;
  --stage-collected-fg: #15734A;        --stage-collected-bg: #E6F3EA;
  --stage-lost-fg:      #B0453B;        --stage-lost-bg:      #F7E9E7;
}

* { box-sizing: border-box; }
body { margin:0; background:var(--cream); color:var(--ink); font-family:'DM Sans',system-ui,sans-serif; }
.btn-primary { background:var(--navy); color:var(--surface); border:none; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
.btn-primary:hover { background:var(--navy-deep); }
.btn-ghost { background:transparent; border:1px solid var(--border); color:var(--ink); padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
.btn-ghost:hover { background:var(--panel); }
`;

function BrandMark() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"center",marginBottom:22}}>
      <div style={{width:38,height:38,borderRadius:10,background:"var(--navy-deep)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Serif Display',serif",fontSize:19,color:"var(--gold-soft)"}}>R</div>
      <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:"var(--navy-deep)"}}>Reclaim <span style={{color:"var(--gold)"}}>CA</span></div>
    </div>
  );
}

function CenteredShell({ children }) {
  return (
    <div style={{minHeight:"100vh",background:"var(--cream)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{width:400,maxWidth:"100%",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:"32px 28px",boxShadow:"0 24px 50px -30px rgba(18,41,63,.4)"}}>
        <BrandMark/>
        {children}
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <CenteredShell>
      <div style={{textAlign:"center"}}>
        <h2 style={{fontFamily:"'DM Serif Display',serif",fontWeight:400,fontSize:20,color:"var(--navy-deep)",margin:"0 0 10px"}}>Connect your database</h2>
        <p style={{fontSize:14,color:"var(--slate)",lineHeight:1.6,margin:0}}>This dashboard needs its Supabase keys before it can load. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see <b>PHASE1_SETUP.md</b>), then redeploy.</p>
      </div>
    </CenteredShell>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email || !pw) return;
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  const field = {width:"100%",padding:"11px 12px",border:"1px solid var(--border)",borderRadius:9,fontSize:14,outline:"none",background:"var(--cream)",fontFamily:"inherit",marginBottom:12};
  return (
    <CenteredShell>
      <div style={{textAlign:"center",marginBottom:18,fontSize:13,color:"var(--slate)"}}>Sign in to your recovery dashboard</div>
      <input style={field} type="email" placeholder="Email" value={email} autoComplete="username"
        onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} />
      <input style={field} type="password" placeholder="Password" value={pw} autoComplete="current-password"
        onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} />
      {err && <div style={{fontSize:13,color:"#A5402F",background:"#FBEBE8",border:"1px solid #F0CFC8",borderRadius:8,padding:"9px 11px",marginBottom:12}}>{err}</div>}
      <button onClick={submit} disabled={busy||!email||!pw}
        style={{width:"100%",padding:"12px",borderRadius:9,border:"none",background:"var(--gold)",color:"var(--navy-deep)",fontWeight:700,fontSize:14,cursor:(busy||!email||!pw)?"default":"pointer",opacity:(busy||!email||!pw)?.6:1,fontFamily:"inherit"}}>
        {busy?"Signing in…":"Sign in"}
      </button>
      <div style={{fontSize:12,color:"var(--slate)",textAlign:"center",marginTop:16,lineHeight:1.5}}>
        Accounts are created in your Supabase project (Authentication → Users). There's no public sign-up.
      </div>
    </CenteredShell>
  );
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); };

  // ── Data (Supabase-backed) ─────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const rowToLead = (r) => ({ ...r.data, id: r.id });
  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*");
    if (error) { setSyncMsg("Load failed: " + error.message); setLoading(false); return; }
    setLeads((data || []).map(rowToLead));
    setLoading(false);
  };
  useEffect(() => {
    if (!session) { setLeads([]); setLoading(false); return; }
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const persistLead = async (lead) => {
    const { error } = await supabase.from("leads").upsert({ id: lead.id, data: lead });
    if (error) setSyncMsg("Save failed: " + error.message);
  };
  const seedSamples = async () => {
    setSyncMsg("");
    const { error } = await supabase.from("leads").upsert(SAMPLE_LEADS.map(l => ({ id: l.id, data: l })));
    if (error) { setSyncMsg("Seed failed: " + error.message); return; }
    await loadLeads();
    setSyncMsg("Sample data loaded.");
  };

  const [tab, setTab] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [drawerTab, setDrawerTab] = useState("details");
  const [showNew, setShowNew] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const openLead = (lead) => { setSelected(lead); setDrawerTab("details"); };

  const saveLead = (updated) => {
    setLeads(ls => ls.map(l => l.id === updated.id ? updated : l));
    setSelected(s => (s && s.id === updated.id ? updated : s));
    persistLead(updated);
  };

  // Handles both PipelineTab (plain lead + target stage) and the drawer
  // (lead already carrying the new stage + activity). No double-logging.
  const moveLead = (lead, stageId) => {
    const u = lead.stage === stageId
      ? lead
      : { ...lead, stage: stageId,
          activity: [...(lead.activity||[]), {date:today(), action:"Stage → "+stageOf(stageId).label}] };
    setLeads(ls => ls.map(l => l.id === u.id ? u : l));
    setSelected(s => (s && s.id === u.id ? u : s));
    persistLead(u);
  };

  const addLead = (lead) => {
    const capped = {...lead, feePercent:capFee(lead.feePercent),
                    feeAmount:feeAmountFor(lead.propertyValue, lead.feePercent)};
    setLeads(ls => [capped, ...ls]);
    persistLead(capped);
    setShowNew(false);
  };

  // Item 5: pull JotForm intake leads that the Netlify webhook created
  // server-side, merge them in, then clear them. Falls back gracefully if the
  // functions aren't deployed yet.
  const syncIntake = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const res = await fetch("/.netlify/functions/pending-leads");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const incoming = await res.json();
      if (!Array.isArray(incoming) || incoming.length === 0) {
        setSyncMsg("No new intake submissions.");
      } else {
        const have = new Set(leads.map(l => l.id));
        const fresh = incoming
          .filter(l => !have.has(l.id))
          .map(l => ({...l, feePercent: capFee(l.feePercent ?? CA_FEE_CAP),
                            feeAmount: feeAmountFor(l.propertyValue, l.feePercent ?? CA_FEE_CAP)}));
        if (fresh.length) {
          await supabase.from("leads").upsert(fresh.map(l => ({ id: l.id, data: l })));
          setLeads(ls => [...fresh, ...ls]);
        }
        try {
          await fetch("/.netlify/functions/pending-leads", {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ ids: incoming.map(l => l.id) })
          });
        } catch (e) { /* clear is best-effort */ }
        setSyncMsg(`Imported ${incoming.length} intake ${incoming.length === 1 ? "submission" : "submissions"}.`);
      }
    } catch (e) {
      setSyncMsg("Sync unavailable — deploy the Netlify functions first.");
    } finally { setSyncing(false); }
  };

  const fileRef = useRef(null);

  // Normalize a lead coming from the Python export (snake_case docs, internal
  // pipeline stages) into the dashboard's schema.
  const VALID_STAGES = new Set(STAGES.map(s => s.id));
  const LEGACY_STAGE = { new:"lead", verified:"lead", letter:"contacted",
                         collected:"fee_collected", filed:"claim_filed", lost:"closed_lost" };
  const normStage = (s) => VALID_STAGES.has(s) ? s : (LEGACY_STAGE[s] || "lead");
  const normDocs = (d = {}) => ({
    agreementSigned:  !!(d.agreementSigned  ?? d.agreement_signed),
    idVerified:       !!(d.idVerified       ?? d.id_verified),
    proofOfOwnership: !!(d.proofOfOwnership  ?? d.proof_of_ownership),
    claimSubmitted:   !!(d.claimSubmitted   ?? d.claim_submitted),
    paymentReceived:  !!(d.paymentReceived  ?? d.payment_received),
  });

  // Import the Python pipeline's reclaim_ca_leads_export.json (upsert by id).
  const importJson = async (file) => {
    if (!file) return;
    setSyncMsg("");
    try {
      const rows = JSON.parse(await file.text());
      if (!Array.isArray(rows)) throw new Error("expected a JSON array of leads");
      const normalized = [];
      for (const r of rows) {
        if (!r || !r.id) continue;
        normalized.push({
          outreachLog: [], activity: [], notes: "", aiNotes: "", paidDate: null,
          ...r,
          propertyState: "CA",
          stage: normStage(r.stage),
          feePercent: capFee(r.feePercent ?? CA_FEE_CAP),
          feeAmount: feeAmountFor(r.propertyValue, r.feePercent ?? CA_FEE_CAP),
          docs: normDocs(r.docs),
        });
      }
      if (normalized.length) {
        const { error } = await supabase.from("leads").upsert(normalized.map(l => ({ id: l.id, data: l })));
        if (error) throw new Error(error.message);
        await loadLeads();
      }
      setSyncMsg(`Imported ${normalized.length} lead${normalized.length === 1 ? "" : "s"} from file.`);
    } catch (e) {
      setSyncMsg("Import failed: " + e.message);
    }
  };

  const renderTab = () => {
    switch (tab) {
      case "leads":    return <LeadsTab leads={leads} stageFilter={stageFilter} setStageFilter={setStageFilter} onSelect={openLead} />;
      case "pipeline": return <PipelineTab leads={leads} onSelect={openLead} onMove={moveLead} />;
      case "states":   return <StatesTab />;
      case "revenue":  return <RevenueTab leads={leads} />;
      case "letters":  return <LettersTab leads={leads} />;
      default:         return <Dashboard leads={leads} onSelect={openLead} />;
    }
  };

  if (!isSupabaseConfigured) return <SetupNotice/>;
  if (!authReady) return <CenteredShell><div style={{textAlign:"center",fontSize:13,color:"var(--slate)"}}>Loading…</div></CenteredShell>;
  if (!session) return <AuthScreen/>;

  return (
    <div style={{minHeight:"100vh",background:"var(--cream)"}}>
      <style>{GLOBAL_CSS}</style>

      <header style={{background:"var(--navy-deep)",color:"var(--surface)",padding:"0 28px"}}>
        <div style={{maxWidth:1180,margin:"0 auto",display:"flex",alignItems:"center",gap:16,minHeight:64,flexWrap:"wrap",rowGap:8,paddingTop:8,paddingBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:"'DM Serif Display',serif",fontWeight:700,fontSize:17,color:"var(--navy-deep)"}}>R</div>
            <div>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:20,lineHeight:1.1}}>Reclaim <span style={{color:"var(--gold-soft)"}}>CA</span></div>
              <div style={{fontSize:11,opacity:.6,letterSpacing:".04em"}}>California Unclaimed Property Recovery</div>
            </div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            {syncMsg && <span style={{fontSize:12,opacity:.75}}>{syncMsg}</span>}
            <input ref={fileRef} type="file" accept="application/json,.json" style={{display:"none"}}
              onChange={e => { importJson(e.target.files && e.target.files[0]); e.target.value=""; }} />
            <button className="btn-ghost" onClick={() => fileRef.current && fileRef.current.click()}
              style={{borderColor:"rgba(255,255,255,.25)",color:"var(--surface)"}}>Import JSON</button>
            <button className="btn-ghost" onClick={syncIntake} disabled={syncing}
              style={{borderColor:"rgba(255,255,255,.25)",color:"var(--surface)",opacity:syncing?.6:1}}>
              {syncing ? "Syncing…" : "Sync Intake"}
            </button>
            <button className="btn-primary" onClick={() => setShowNew(true)}
              style={{background:"var(--gold)",color:"var(--navy-deep)"}}>+ New Lead</button>
            {!loading && leads.length === 0 && (
              <button className="btn-ghost" onClick={seedSamples}
                style={{borderColor:"rgba(255,255,255,.25)",color:"var(--surface)"}}>Load sample data</button>
            )}
            <button className="btn-ghost" onClick={signOut}
              style={{borderColor:"rgba(255,255,255,.25)",color:"var(--surface)"}}>Sign out</button>
          </div>
        </div>
        <div style={{maxWidth:1180,margin:"0 auto",display:"flex",gap:4,overflowX:"auto"}}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{background:"none",border:"none",color:tab===t.id?"var(--surface)":"rgba(255,255,255,.6)",
                borderBottom:`2px solid ${tab===t.id?"var(--gold)":"transparent"}`,
                padding:"12px 14px",fontSize:13,fontWeight:tab===t.id?700:500,cursor:"pointer",fontFamily:"inherit"}}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{maxWidth:1180,margin:"0 auto",padding:"clamp(16px,4vw,28px)"}}>
        {loading ? <div style={{textAlign:"center",color:"var(--slate)",padding:"60px 0",fontSize:14}}>Loading your leads…</div> : renderTab()}
      </main>

      {selected && (
        <LeadDrawer lead={selected} drawerTab={drawerTab} setDrawerTab={setDrawerTab}
          onClose={() => setSelected(null)} onSave={saveLead} onMove={moveLead} />
      )}
      {showNew && <NewLeadModal onClose={() => setShowNew(false)} onSave={addLead} />}
    </div>
  );
}
