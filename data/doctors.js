const doctors = [
  {
    id: 1,
    name: "Dr. Rohit Raj",
    specialization: "General Physician",
    phone: "917760330138",
  },
];

let doctorIndex = 0;

function assignDoctor() {
  const doctor = doctors[doctorIndex];
  doctorIndex = (doctorIndex + 1) % doctors.length;
  return doctor;
}

module.exports = { doctors, assignDoctor };