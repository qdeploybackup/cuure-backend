const getBookingLink = () => {
  return process.env.CUURE_APPOINTMENT_URL || 'https://www.cuure.health/appointment';
};

module.exports = {
  getBookingLink
};
