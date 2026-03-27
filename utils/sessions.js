const users = {};
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: "START", temp: {} };
  }
  return sessions[phone];
}

module.exports = { users, sessions, getSession };