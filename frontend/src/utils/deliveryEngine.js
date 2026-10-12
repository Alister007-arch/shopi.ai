/**
 * Genuine Indian Postal PIN Code & E-Commerce Delivery Serviceability Engine
 * Supports Bengaluru HQ (4-hour express), Tier-1 Metro hubs, and all Indian postal circles.
 */

const PINCODE_METRO_MAP = {
  // Bengaluru (Trovi HQ Hub - Same-day 4-hour ultra express)
  '560034': { city: 'Bengaluru', state: 'Karnataka', area: 'Koramangala / 4th Block', express: true, sameDay: true },
  '560038': { city: 'Bengaluru', state: 'Karnataka', area: 'Indiranagar / 100ft Road', express: true, sameDay: true },
  '560001': { city: 'Bengaluru', state: 'Karnataka', area: 'MG Road / Central Business District', express: true, sameDay: true },
  '560066': { city: 'Bengaluru', state: 'Karnataka', area: 'Whitefield / ITPL Hub', express: true, sameDay: true },
  '560102': { city: 'Bengaluru', state: 'Karnataka', area: 'HSR Layout / Sector 1-7', express: true, sameDay: true },
  '560078': { city: 'Bengaluru', state: 'Karnataka', area: 'JP Nagar / 6th Phase', express: true, sameDay: true },
  '560025': { city: 'Bengaluru', state: 'Karnataka', area: 'Richmond Town / Ashok Nagar', express: true, sameDay: true },
  '560004': { city: 'Bengaluru', state: 'Karnataka', area: 'Basavanagudi / Gandhi Bazaar', express: true, sameDay: true },

  // New Delhi / NCR
  '110001': { city: 'New Delhi', state: 'Delhi', area: 'Connaught Place / Central Delhi', express: true, sameDay: true },
  '110016': { city: 'New Delhi', state: 'Delhi', area: 'Hauz Khas / Green Park', express: true, sameDay: true },
  '110024': { city: 'New Delhi', state: 'Delhi', area: 'Defence Colony / Lajpat Nagar', express: true, sameDay: true },
  '110075': { city: 'New Delhi', state: 'Delhi', area: 'Dwarka Sector 10-14', express: true, sameDay: true },
  '122002': { city: 'Gurugram', state: 'Haryana', area: 'DLF Phase 1-5 / Golf Course Rd', express: true, sameDay: true },
  '201301': { city: 'Noida', state: 'Uttar Pradesh', area: 'Sector 18 / Atta Market Hub', express: true, sameDay: true },

  // Mumbai / MMR
  '400001': { city: 'Mumbai', state: 'Maharashtra', area: 'Fort / Nariman Point / Colaba', express: true, sameDay: true },
  '400050': { city: 'Mumbai', state: 'Maharashtra', area: 'Bandra West / Pali Hill', express: true, sameDay: true },
  '400053': { city: 'Mumbai', state: 'Maharashtra', area: 'Andheri West / Lokhandwala', express: true, sameDay: true },
  '400076': { city: 'Mumbai', state: 'Maharashtra', area: 'Powai / Hiranandani Gardens', express: true, sameDay: true },

  // Hyderabad
  '500034': { city: 'Hyderabad', state: 'Telangana', area: 'Banjara Hills / Road No. 12', express: true, sameDay: true },
  '500081': { city: 'Hyderabad', state: 'Telangana', area: 'Madhapur / HITEC City', express: true, sameDay: true },
  '500032': { city: 'Hyderabad', state: 'Telangana', area: 'Gachibowli Financial District', express: true, sameDay: true },

  // Pune
  '411001': { city: 'Pune', state: 'Maharashtra', area: 'Camp / Bund Garden', express: true, sameDay: true },
  '411006': { city: 'Pune', state: 'Maharashtra', area: 'Yerwada / Viman Nagar', express: true, sameDay: true },
  '411057': { city: 'Pune', state: 'Maharashtra', area: 'Hinjewadi IT Park Phase 1', express: true, sameDay: true },

  // Chennai
  '600017': { city: 'Chennai', state: 'Tamil Nadu', area: 'T Nagar / Pondy Bazaar', express: true, sameDay: true },
  '600020': { city: 'Chennai', state: 'Tamil Nadu', area: 'Adyar / Besant Nagar', express: true, sameDay: true },

  // Kolkata
  '700016': { city: 'Kolkata', state: 'West Bengal', area: 'Park Street / Camac Street', express: true, sameDay: false },
  '700091': { city: 'Kolkata', state: 'West Bengal', area: 'Salt Lake Sector V', express: true, sameDay: false },

  // Ahmedabad
  '380015': { city: 'Ahmedabad', state: 'Gujarat', area: 'Satellite / Vastrapur Lake', express: true, sameDay: false },
};

// Circle prefix map for general 6-digit Indian PIN codes
const POSTAL_CIRCLE_PREFIXES = {
  '11': { city: 'New Delhi', state: 'Delhi' },
  '12': { city: 'Gurugram / Faridabad', state: 'Haryana' },
  '13': { city: 'Ambala / Panipat', state: 'Haryana' },
  '14': { city: 'Chandigarh / Mohali', state: 'Punjab' },
  '16': { city: 'Chandigarh', state: 'Punjab' },
  '17': { city: 'Shimla / Solan', state: 'Himachal Pradesh' },
  '18': { city: 'Jammu / Srinagar', state: 'Jammu & Kashmir' },
  '19': { city: 'Srinagar', state: 'Jammu & Kashmir' },
  '20': { city: 'Noida / Ghaziabad / Meerut', state: 'Uttar Pradesh' },
  '21': { city: 'Prayagraj', state: 'Uttar Pradesh' },
  '22': { city: 'Lucknow / Varanasi', state: 'Uttar Pradesh' },
  '24': { city: 'Dehradun / Haridwar', state: 'Uttarakhand' },
  '26': { city: 'Bareilly / Kumaon', state: 'Uttar Pradesh' },
  '30': { city: 'Jaipur', state: 'Rajasthan' },
  '31': { city: 'Udaipur / Kota', state: 'Rajasthan' },
  '34': { city: 'Jodhpur', state: 'Rajasthan' },
  '36': { city: 'Rajkot', state: 'Gujarat' },
  '38': { city: 'Ahmedabad / Gandhinagar', state: 'Gujarat' },
  '39': { city: 'Surat / Vadodara', state: 'Gujarat' },
  '40': { city: 'Mumbai / Thane', state: 'Maharashtra' },
  '41': { city: 'Pune / Nashik', state: 'Maharashtra' },
  '42': { city: 'Nashik / Jalgaon', state: 'Maharashtra' },
  '44': { city: 'Nagpur', state: 'Maharashtra' },
  '45': { city: 'Indore', state: 'Madhya Pradesh' },
  '46': { city: 'Bhopal', state: 'Madhya Pradesh' },
  '49': { city: 'Raipur', state: 'Chhattisgarh' },
  '50': { city: 'Hyderabad / Secunderabad', state: 'Telangana' },
  '51': { city: 'Tirupati / Rayalaseema', state: 'Andhra Pradesh' },
  '52': { city: 'Vijayawada / Guntur', state: 'Andhra Pradesh' },
  '53': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  '56': { city: 'Bengaluru', state: 'Karnataka' },
  '57': { city: 'Mysuru / Mangaluru', state: 'Karnataka' },
  '58': { city: 'Hubballi / Belagavi', state: 'Karnataka' },
  '60': { city: 'Chennai / Kanchipuram', state: 'Tamil Nadu' },
  '62': { city: 'Madurai', state: 'Tamil Nadu' },
  '64': { city: 'Coimbatore', state: 'Tamil Nadu' },
  '67': { city: 'Kozhikode', state: 'Kerala' },
  '68': { city: 'Kochi / Ernakulam', state: 'Kerala' },
  '69': { city: 'Thiruvananthapuram', state: 'Kerala' },
  '70': { city: 'Kolkata / Howrah', state: 'West Bengal' },
  '75': { city: 'Bhubaneswar / Cuttack', state: 'Odisha' },
  '78': { city: 'Guwahati / Assam', state: 'Assam' },
  '80': { city: 'Patna', state: 'Bihar' },
  '83': { city: 'Ranchi / Jamshedpur', state: 'Jharkhand' },
};

/**
 * Validates and looks up Indian PIN code serviceability details
 * @param {string} pin - 6-digit PIN code
 * @returns {object} Serviceability report
 */
export function lookupPincode(pin) {
  const clean = String(pin || '').trim().replace(/\D/g, '');

  if (!clean || clean.length !== 6 || clean.startsWith('0')) {
    return {
      valid: false,
      pin: clean,
      message: 'Please enter a valid 6-digit Indian postal PIN code (e.g. 560034, 110001, 400001).',
      city: '',
      state: '',
      area: '',
      serviceable: false,
      expressAvailable: false,
      sameDayAvailable: false,
    };
  }

  // Exact match from curated metro list
  if (PINCODE_METRO_MAP[clean]) {
    const info = PINCODE_METRO_MAP[clean];
    const isBengaluru = clean.startsWith('560');

    return {
      valid: true,
      pin: clean,
      city: info.city,
      state: info.state,
      area: info.area,
      serviceable: true,
      isMetro: true,
      isHqHub: isBengaluru,
      expressAvailable: info.express,
      sameDayAvailable: info.sameDay,
      estimatedDeliveryText: isBengaluru
        ? '⚡ Ultra-Fast 4-Hour Delivery available'
        : '🌱 Next-Day Morning Delivery by 8:00 AM',
      codAvailable: true,
      freeShippingThresholdInr: 499,
      deliveryMethod: 'Verified Express Courier',
    };
  }

  // Circle prefix match
  const p2 = clean.slice(0, 2);
  if (POSTAL_CIRCLE_PREFIXES[p2]) {
    const info = POSTAL_CIRCLE_PREFIXES[p2];
    const isBengaluruRegion = clean.startsWith('560');

    return {
      valid: true,
      pin: clean,
      city: info.city,
      state: info.state,
      area: `${info.city} Postal Circle`,
      serviceable: true,
      isMetro: ['Delhi', 'Mumbai', 'Karnataka', 'Telangana', 'Maharashtra'].includes(info.state),
      isHqHub: isBengaluruRegion,
      expressAvailable: isBengaluruRegion,
      sameDayAvailable: isBengaluruRegion,
      estimatedDeliveryText: isBengaluruRegion
        ? '⚡ Same-Day Delivery available for orders placed by 2 PM'
        : '📦 Priority Express delivery in 24 - 48 Hours',
      codAvailable: true,
      freeShippingThresholdInr: 499,
      deliveryMethod: 'Verified Partner Delivery',
    };
  }

  // Fallback valid Indian PIN code
  const firstDigit = parseInt(clean[0], 10);
  const zoneNames = {
    1: 'North Zone (Delhi / Haryana / Punjab)',
    2: 'North Zone (Uttar Pradesh / Uttarakhand)',
    3: 'West Zone (Rajasthan / Gujarat)',
    4: 'West Zone (Maharashtra / Goa / MP)',
    5: 'South Zone (Karnataka / Telangana / AP)',
    6: 'South Zone (Tamil Nadu / Kerala)',
    7: 'East Zone (West Bengal / Odisha / North East)',
    8: 'East Zone (Bihar / Jharkhand)',
  };

  return {
    valid: true,
    pin: clean,
    city: 'India Region',
    state: zoneNames[firstDigit] || 'Pan-India',
    area: `Postal Sector ${clean.slice(0, 3)}`,
    serviceable: true,
    isMetro: false,
    isHqHub: false,
    expressAvailable: false,
    sameDayAvailable: false,
    estimatedDeliveryText: '📦 Standard Priority Courier in 2 - 3 Days',
    codAvailable: true,
    freeShippingThresholdInr: 499,
    deliveryMethod: 'Standard Courier',
  };
}

/**
 * Returns selectable genuine delivery tiers for Cart & Checkout
 * @param {string} pin
 * @param {number} cartTotalInr
 * @returns {Array<object>} delivery options
 */
export function getSelectableDeliveryOptions(pin = '560034', cartTotalInr = 0) {
  const pinInfo = lookupPincode(pin);
  const isFreeOver499 = cartTotalInr >= 499;

  const options = [
    {
      id: 'eco_standard',
      name: 'Standard Delivery',
      badge: 'Fast & Reliable',
      fee: isFreeOver499 ? 0 : 50,
      feeText: isFreeOver499 ? 'FREE' : '₹50',
      eta: '2 - 3 Days',
      timeSlot: 'Flexible (9 AM - 7 PM)',
      description: 'Dispatched via verified courier partners in secure packaging.',
      icon: 'Leaf',
      recommended: !pinInfo.isHqHub,
    },
    {
      id: 'scheduled_morning',
      name: 'Scheduled Morning Slot',
      badge: 'Fresh Farm Cold-Chain',
      fee: isFreeOver499 ? 0 : 40,
      feeText: isFreeOver499 ? 'FREE' : '₹40',
      eta: 'Tomorrow Morning',
      timeSlot: '7:00 AM - 10:00 AM',
      description: 'Ideal for dairy, cold-pressed oils & fresh produce before start of day.',
      icon: 'Clock',
      recommended: false,
    },
  ];

  // If PIN is in ultra-fast express zone (e.g. Bengaluru / NCR / Mumbai)
  if (pinInfo.expressAvailable) {
    const isExpressFree = cartTotalInr >= 999;
    options.unshift({
      id: 'express_4hr',
      name: pinInfo.isHqHub ? '⚡ 4-Hour Ultra Express' : '⚡ Same-Day Express',
      badge: pinInfo.isHqHub ? 'Bengaluru Hub Express' : 'Metro Express',
      fee: isExpressFree ? 0 : 99,
      feeText: isExpressFree ? 'FREE (Orders > ₹999)' : '₹99',
      eta: pinInfo.isHqHub ? 'Within 4 Hours' : 'By Tonight, 8:00 PM',
      timeSlot: 'Priority VIP Dispatch',
      description: 'Hand-picked from nearest temperature-controlled micro-fulfilment center.',
      icon: 'Zap',
      recommended: true,
    });
  }

  return options;
}
