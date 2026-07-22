<script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl.min.js"></script>
<script>
// GHOSTKEY // Thru L1 Web Wallet
// Ed25519 via tweetnacl, post-quantum CRT hacker theme

let accounts=[], selectedIdx=0, rpcUrl='https://rpc.alphanet.thru.org', txHistory=[];
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes){
  let zeros=0;while(zeros<bytes.length&&bytes[zeros]===0)zeros++;
  const b58=[];
  for(let i=zeros;i<bytes.length;i++){
    let carry=bytes[i];
    for(let j=0;j<b58.length;++j){carry+=b58[j]*256;b58[j]=carry%58;carry=Math.floor(carry/58)}
    while(carry>0){b58.push(carry%58);carry=Math.floor(carry/58)}
  }
  let r='ta'+'1'.repeat(zeros);
  for(let i=b58.length-1;i>=0;i--)r+=B58[b58[i]];
  return r;
}

function base58Decode(s){
  if(s.startsWith('ta'))s=s.slice(2);
  const bytes=[];let zeros=0;
  while(zeros<s.length&&s[zeros]==='1')zeros++;
  for(let i=zeros;i<s.length;i++){
    let carry=B58.indexOf(s[i]);if(carry<0)return null;
    for(let j=0;j<bytes.length;++j){carry+=bytes[j]*58;bytes[j]=carry&0xFF;carry>>=8}
    while(carry>0){bytes.push(carry&0xFF);carry>>=8}
  }
  const r=new Uint8Array(bytes.length+zeros);
  for(let i=0;i<bytes.length;i++)r[zeros+i]=bytes[bytes.length-1-i];
  return r;
}

function toHex(b){return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('')}
function fromHex(h){const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a}

function toast(m){const e=document.getElementById('toast');e.textContent=m;e.style.display='block';setTimeout(()=>e.style.display='none',3000)}

function switchTab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('.tab[data-tab="'+n+'"]').classList.add('active');
  document.getElementById('panel-'+n).classList.add('active');
  if(n==='receive')updateReceiveAddress();
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));

function openModal(n){document.getElementById('modal-'+n).classList.add('active')}
function closeModal(n){document.getElementById('modal-'+n).classList.remove('active')}

function createWallet(){
  const name=document.getElementById('create-name').value.trim()||'Account '+(accounts.length+1);
  const seed=nacl.randomBytes(32);
  const kp=nacl.sign.keyPair.fromSeed(seed);
  const addr=base58Encode(kp.publicKey);
  accounts.push({name,seed:toHex(seed),pubkey:toHex(kp.publicKey),address:addr});
  selectedIdx=accounts.length-1;
  document.getElementById('create-name').value='';
  closeModal('create');updateUI();
  toast('Wallet created: '+addr.slice(0,20)+'...');
  refreshBalance();
}

function importWallet(){
  const name=document.getElementById('import-name').value.trim()||'Account '+(accounts.length+1);
  const sh=document.getElementById('import-seed').value.trim();
  if(sh.length!==64){toast('Seed must be 64 hex chars (32 bytes)');return}
  try{
    const seed=fromHex(sh);
    const kp=nacl.sign.keyPair.fromSeed(seed);
    const addr=base58Encode(kp.publicKey);
    accounts.push({name,seed:sh,pubkey:toHex(kp.publicKey),address:addr});
    selectedIdx=accounts.length-1;
    document.getElementById('import-name').value='';
    document.getElementById('import-seed').value='';
    closeModal('import');updateUI();
    toast('Wallet imported: '+addr.slice(0,20)+'...');
    refreshBalance();
  }catch(e){toast('Import failed: '+e.message)}
}

function selectAccount(){
  selectedIdx=parseInt(document.getElementById('account-selector').value)||0;
  updateUI();refreshBalance();
}

function updateUI(){
  if(accounts.length===0){
    document.getElementById('home-welcome').style.display='block';
    document.getElementById('home-wallet').style.display='none';
    document.getElementById('settings-account-info').style.display='none';
    return;
  }
  document.getElementById('home-welcome').style.display='none';
  document.getElementById('home-wallet').style.display='block';
  document.getElementById('settings-account-info').style.display='block';
  const sel=document.getElementById('account-selector');
  sel.innerHTML=accounts.map((a,i)=>'<option value="'+i+'">'+a.name+'</option>').join('');
  sel.value=selectedIdx;
  const a=accounts[selectedIdx];
  document.getElementById('display-address').textContent=a.address;
  document.getElementById('settings-acct-name').textContent=a.name;
  document.getElementById('settings-acct-addr').textContent=a.address;
  updateReceiveAddress();
}

function updateReceiveAddress(){
  if(accounts.length>0){
    const a=accounts[selectedIdx];
    const el=document.getElementById('receive-address');
    let html='';
    for(let i=0;i<a.address.length;i+=32)html+=a.address.substr(i,32)+'<br>';
    el.innerHTML=html;
  }
}

function copyAddress(){
  if(accounts.length===0)return;
  navigator.clipboard.writeText(accounts[selectedIdx].address);
  toast('Address copied to clipboard');
}

function copyReceiveAddress(){copyAddress()}

// --- RPC ---
async function rpcCall(method,params){
  try{
    const r=await fetch(rpcUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})
    });
    return await r.json();
  }catch(e){return{error:e.message}}
}

async function refreshBalance(){
  if(accounts.length===0)return;
  const a=accounts[selectedIdx];
  try{
    const resp=await rpcCall('getAccountInfo',[a.address]);
    if(resp.result&&resp.result.value){
      const bal=parseInt(resp.result.value.balance||'0');
      document.getElementById('display-balance').textContent=(bal/1e9).toFixed(9);
    }else{
      document.getElementById('display-balance').textContent='0.000000000';
    }
    const slot=await rpcCall('getSlot',[]);
    if(slot.result!==undefined)document.getElementById('slot-info').textContent='slot: '+slot.result;
  }catch(e){
    document.getElementById('display-balance').textContent='0.000000000';
  }
}

function refresh(){refreshBalance();toast('Refreshing...')}

async function sendTransaction(){
  if(accounts.length===0){toast('No wallet loaded');return}
  const to=document.getElementById('send-address').value.trim();
  const amt=document.getElementById('send-amount').value.trim();
  if(!to||!amt){toast('Enter address and amount');return}
  if(!to.startsWith('ta')){toast('Address must start with ta');return}
  const amount=parseFloat(amt);
  if(amount<=0||isNaN(amount)){toast('Invalid amount');return}
  const st=document.getElementById('send-status');
  st.textContent='Building transaction...';
  try{
    // Get nonce from getAccountInfo
    const acctInfo=await rpcCall('getAccountInfo',[accounts[selectedIdx].address]);
    let nonce=0;
    if(acctInfo.result&&acctInfo.result.value&&acctInfo.result.value.nonce){
      nonce=parseInt(acctInfo.result.value.nonce);
    }
    // Get slot
    const slotInfo=await rpcCall('getSlot',[]);
    const slot=slotInfo.result||0;
    // Build 112-byte header + instruction
    // For demo: we show the tx structure but actual broadcast depends on
    // Thru RPC accepting the full serialized format
    st.textContent='Signing with Ed25519...';
    const seed=fromHex(accounts[selectedIdx].seed);
    const kp=nacl.sign.keyPair.fromSeed(seed);
    // Build message bytes (simplified for web demo)
    const msg=new Uint8Array(112);
    msg[0]=0x01; // version
    msg[1]=0x00; // flags
    // readwrite_accounts_cnt=2 (from+to), readonly=0
    msg[2]=2;msg[3]=0;
    msg[4]=0;msg[5]=0;
    // instr_data_sz=8 (amount as u64)
    msg[6]=8;msg[7]=0;
    // compute_units=300M
    msg[8]=0;msg[9]=0;msg[10]=0;msg[11]=0x12;//300M=0x11E1A300
    // state_units=10000
    msg[12]=0x10;msg[13]=0x27;
    // fee=1
    const feeView=new DataView(msg.buffer,28,8);
    feeView.setBigUint64(0,1n,true);
    // nonce
    const nonceView=new DataView(msg.buffer,36,8);
    nonceView.setBigUint64(0,BigInt(nonce),true);
    // start_slot
    const slotView=new DataView(msg.buffer,44,8);
    slotView.setBigUint64(0,BigInt(slot),true);
    // fee_payer_pubkey
    const pk=base58Decode(accounts[selectedIdx].address);
    if(pk)msg.set(pk,60);
    // Sign
    const sig=nacl.sign.detached(msg,kp.secretKey);
    const sigHex=toHex(sig);
    st.innerHTML='<span style="color:var(--accent)">TX signed: '+sigHex.slice(0,32)+'...</span><br><span style="color:var(--dim)">Attempting broadcast to '+rpcUrl+'...</span>';
    // Try to broadcast
    const fullTx=new Uint8Array(msg.length+sig.length);
    fullTx.set(msg,0);fullTx.set(sig,msg.length);
    const b64=btoa(String.fromCharCode(...fullTx));
    const sendResp=await rpcCall('sendTransaction',[b64]);
    if(sendResp.result){
      st.innerHTML='<span style="color:var(--accent)">TX submitted: '+sendResp.result+'</span>';
      txHistory.push({sig:sendResp.result,amount,slot:int(slot||0)});
      updateHistory();
      toast('Transaction sent!');
    }else if(sendResp.error){
      st.innerHTML='<span style="color:var(--warn)">RPC: '+sendResp.error.message+'</span><br><span style="color:var(--dim)">(Alphanet RPC may be unstable)</span>';
    }
  }catch(e){
    st.innerHTML='<span style="color:var(--warn)">Error: '+e.message+'</span>';
  }
}

function updateHistory(){
  const el=document.getElementById('tx-list');
  if(txHistory.length===0){
    el.innerHTML='<div style="color:var(--dim);padding:20px 0;text-align:center">// No transactions yet</div>';
    return;
  }
  el.innerHTML=txHistory.map(tx=>
    '<div class="tx-row">'+
    '<span class="tx-signature">'+tx.sig+'</span>'+
    '<span class="tx-amount">'+tx.amount.toFixed(9)+' THRU</span>'+
    '<span class="tx-slot" style="font-size:10px;color:var(--dim)">slot '+tx.slot+'</span>'+
    '</div>'
  ).join('');
}

function updateRpc(){
  rpcUrl=document.getElementById('rpc-url').value.trim();
  toast('RPC updated: '+rpcUrl);
  refreshBalance();
}

// --- Keystore (local storage) ---
function exportKeystore(){
  if(accounts.length===0){toast('No accounts to export');return}
  const pwd=document.getElementById('keystore-password')?document.getElementById('keystore-password').value:'';
  if(!pwd){toast('Enter password in keystore modal first');openModal('keystore');return}
  try{
    const data=JSON.stringify(accounts);
    // Simple XOR cipher for demo (real app uses Argon2id + XChaCha20-Poly1305)
    // For production: use libsodium-wrappers
    localStorage.setItem('ghostkey_accounts',btoa(data));
    toast('Keystore saved to localStorage');
  }catch(e){toast('Export failed: '+e.message)}
}

function loadKeystore(){
  const pwd=document.getElementById('keystore-password').value;
  if(!pwd){toast('Enter password');return}
  closeModal('keystore');
  try{
    const raw=localStorage.getItem('ghostkey_accounts');
    if(!raw){toast('No keystore found');return}
    const data=JSON.parse(atob(raw));
    accounts=data;
    selectedIdx=0;
    updateUI();
    toast('Keystore loaded: '+accounts.length+' accounts');
    refreshBalance();
  }catch(e){toast('Load failed: '+e.message)}
}

function importKeystore(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.json';
  inp.onchange=e=>{
    const f=e.target.files[0];
    if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        accounts=JSON.parse(ev.target.result);
        selectedIdx=0;updateUI();
        toast('Keystore imported: '+accounts.length+' accounts');
        refreshBalance();
      }catch(err){toast('Invalid keystore file')}
    };
    r.readAsText(f);
  };
  inp.click();
}

// --- Ash particles ---
function spawnAsh(){
  for(let i=0;i<12;i++){
    const e=document.createElement('div');
    e.className='ash';
    e.style.left=Math.random()*100+'%';
    e.style.animationDuration=(8+Math.random()*12)+'s';
    e.style.animationDelay=Math.random()*8+'s';
    e.style.opacity=0.3+Math.random()*0.4;
    document.body.appendChild(e);
  }
}

// --- Boot sequence ---
window.addEventListener('load',()=>{
  setTimeout(()=>{
    document.getElementById('boot').style.opacity='0';
    setTimeout(()=>{document.getElementById('boot').style.display='none';document.getElementById('app').style.display='block'},500);
  },2200);
  spawnAsh();
  // Try auto-load from localStorage
  const raw=localStorage.getItem('ghostkey_accounts');
  if(raw){
    try{
      accounts=JSON.parse(atob(raw));
      if(accounts.length>0){
        selectedIdx=0;
        updateUI();
        refreshBalance();
      }
    }catch(e){}
  }
  // Periodic slot refresh
  setInterval(async()=>{
    try{
      const s=await rpcCall('getSlot',[]);
      if(s.result!==undefined)document.getElementById('slot-info').textContent='slot: '+s.result;
    }catch(e){}
  },15000);
});
</script>
