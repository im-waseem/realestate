export type StateStampDutyRate = {
  state: string;
  stampDutyPercent: number;
  registrationPercent: number;
};

// Editable indicative defaults only. Rates differ by city, property, buyer and applicable surcharges.
export const INDIA_STAMP_DUTY_RATES: StateStampDutyRate[] = [
  { state: "Andaman and Nicobar Islands", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Andhra Pradesh", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Arunachal Pradesh", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Assam", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Bihar", stampDutyPercent: 6, registrationPercent: 2 },
  { state: "Chandigarh", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Chhattisgarh", stampDutyPercent: 5, registrationPercent: 4 },
  { state: "Dadra and Nagar Haveli and Daman and Diu", stampDutyPercent: 4.9, registrationPercent: 1 },
  { state: "Delhi", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Goa", stampDutyPercent: 3, registrationPercent: 3 },
  { state: "Gujarat", stampDutyPercent: 4.9, registrationPercent: 1 },
  { state: "Haryana", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Himachal Pradesh", stampDutyPercent: 6, registrationPercent: 2 },
  { state: "Jammu and Kashmir", stampDutyPercent: 7, registrationPercent: 1 },
  { state: "Jharkhand", stampDutyPercent: 4, registrationPercent: 3 },
  { state: "Karnataka", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Kerala", stampDutyPercent: 8, registrationPercent: 2 },
  { state: "Ladakh", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Lakshadweep", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Madhya Pradesh", stampDutyPercent: 7.5, registrationPercent: 3 },
  { state: "Maharashtra", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Manipur", stampDutyPercent: 7, registrationPercent: 1 },
  { state: "Meghalaya", stampDutyPercent: 9.9, registrationPercent: 1 },
  { state: "Mizoram", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Nagaland", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Odisha", stampDutyPercent: 5, registrationPercent: 2 },
  { state: "Puducherry", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Punjab", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Rajasthan", stampDutyPercent: 6, registrationPercent: 1 },
  { state: "Sikkim", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Tamil Nadu", stampDutyPercent: 7, registrationPercent: 2 },
  { state: "Telangana", stampDutyPercent: 4, registrationPercent: 0.5 },
  { state: "Tripura", stampDutyPercent: 5, registrationPercent: 1 },
  { state: "Uttar Pradesh", stampDutyPercent: 7, registrationPercent: 1 },
  { state: "Uttarakhand", stampDutyPercent: 5, registrationPercent: 2 },
  { state: "West Bengal", stampDutyPercent: 6, registrationPercent: 1 },
];
