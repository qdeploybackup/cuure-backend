async function fetchAppointments() {
  const res = await fetch('/api/admin/appointments', { credentials: 'same-origin' });
  const j = await res.json();
  if (!j.success) throw new Error('Failed to fetch');
  return j.data || [];
}

function formatDate(d){
  return d;
}

function renderTable(rows){
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = '';
  rows.forEach(r =>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.patient_name || ''}</td>
      <td>${r.phone || ''}</td>
      <td>${r.date || ''}</td>
      <td>${r.time_label || ''}</td>
      <td>${r.doctor_name || ''}</td>
      <td>${r.doctor_specialization || ''}</td>
      <td>${r.source || '-'}</td>
      <td>${r.status || ''}</td>
      <td>
    ${r.address || "Not provided"}
    ${r.location_link ? `<br><a href="${r.location_link}" target="_blank">📍 Map</a>` : ""}
  </td>

    `;
    tbody.appendChild(tr);
  });
  document.getElementById('count').textContent = `Showing ${rows.length} record(s)`;
}

function applyFilters(data){
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const dateFrom = document.getElementById('date_from').value;
  const dateTo = document.getElementById('date_to').value;
  const doctor = document.getElementById('doctor').value;

  return data.filter(r =>{
    if (q){
      const hay = (r.patient_name||'').toLowerCase() + ' ' + (r.phone||'');
      if (!hay.includes(q)) return false;
    }
    if (dateFrom){
      if (r.date < dateFrom) return false;
    }
    if (dateTo){
      if (r.date > dateTo) return false;
    }
    if (doctor){
      if ((r.doctor_name||'') !== doctor) return false;
    }
    return true;
  });
}

function populateDoctorSelect(data){
  const sel = document.getElementById('doctor');
  const names = Array.from(new Set(data.map(d=>d.doctor_name).filter(Boolean)));
  names.forEach(n=>{
    const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
  });
}


function exportToExcel(rows){
  if (!rows.length) return alert('No rows to export');
  const data = rows.map(r=>({
    ID: r.id,
    Patient: r.patient_name,
    Phone: r.phone,
    Date: r.date,
    Time: r.time_label,
    Doctor: r.doctor_name,
    Specialization: r.doctor_specialization,
    Status: r.status
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Appointments');
  XLSX.writeFile(wb, `appointments_${new Date().toISOString().slice(0,10)}.xlsx`);
}

let allData = [];

async function init(){
  try{
    allData = await fetchAppointments();
    populateDoctorSelect(allData);
    renderTable(allData);

    document.getElementById('apply').addEventListener('click', ()=>{
      const filtered = applyFilters(allData);
      renderTable(filtered);
    });

    document.getElementById('reset').addEventListener('click', ()=>{
      document.getElementById('q').value='';
      document.getElementById('date_from').value='';
      document.getElementById('date_to').value='';
      document.getElementById('doctor').value='';
      renderTable(allData);
    });

    document.getElementById('export').addEventListener('click', ()=>{
      const displayed = Array.from(document.querySelectorAll('#tbl tbody tr')).map(tr=>{
        const tds = tr.querySelectorAll('td');
        return {
          id: tds[0].textContent,
          patient_name: tds[1].textContent,
          phone: tds[2].textContent,
          date: tds[3].textContent,
          time_label: tds[4].textContent,
          doctor_name: tds[5].textContent,
          doctor_specialization: tds[6].textContent,
          status: tds[7].textContent,
        };
      });
      exportToExcel(displayed);
    });

    // Add form modal behavior
    const toggle = document.getElementById('toggle-add');
    const modal = document.getElementById('addModal');
    const addCancel = document.getElementById('add_cancel');
    const addClose = document.getElementById('add_close');
    const addSubmit = document.getElementById('add_submit');

    function openModal(){ modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); const p = document.getElementById('a_phone'); if(p) p.focus(); }
    function closeModal(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }

    toggle.addEventListener('click', ()=>{ openModal(); });
    addCancel.addEventListener('click', (e)=>{ e.preventDefault(); closeModal(); });
    addClose.addEventListener('click', ()=>{ closeModal(); });

    // close when clicking outside modal content
    modal.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });
    // close on Escape
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

    addSubmit.addEventListener('click', async (ev)=>{
      const payload = {
        phone: document.getElementById('a_phone').value.trim(),
        patient_name: document.getElementById('a_name').value.trim(),
        date: document.getElementById('a_date').value,
        time_value: document.getElementById('a_time').value.trim(),
        time_label: document.getElementById('a_time_label').value.trim(),
        doctor_name: document.getElementById('a_doctor').value.trim(),
        doctor_specialization: document.getElementById('a_spec').value.trim(),
      };

      try{
        const res = await fetch('/api/admin/appointments', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await res.json();
        if (!j.success) throw new Error(j.error||'Failed');
        closeModal();
        // refresh data
        allData = await fetchAppointments();
        populateDoctorSelect(allData);
        renderTable(allData);
        alert('Appointment added');
      }catch(e){
        console.error(e);
        alert('Failed to add appointment: '+(e.message||e));
      }
    });

  }catch(e){
    console.error(e);
    alert('Failed to load appointments');
  }
}

init();