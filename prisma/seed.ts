import "dotenv/config";
import {
  PrismaClient,
  type BloodGroup,
  type ContentType,
  type FacilityType,
  type Gender,
  type Language,
  type Prisma,
  type User,
} from "../generated/prisma/client";
import { createDbAdapter } from "../lib/db-adapter";

const db = new PrismaClient({ adapter: createDbAdapter(process.env.DATABASE_URL!) });

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);
const taka = (amount: number) => Math.round(amount * 100);

type UserSeed = Partial<Omit<User, "id" | "phone" | "createdAt" | "updatedAt">>;

async function upsertUserByPhone(phone: string, data: UserSeed) {
  return db.user.upsert({ where: { phone }, update: data, create: { phone, ...data } });
}

async function findOrCreateFacility(data: Prisma.FacilityUncheckedCreateInput) {
  const existing = await db.facility.findFirst({ where: { name: data.name } });
  return existing ?? db.facility.create({ data });
}

async function findOrCreateMedicine(data: Prisma.MedicineCreateInput) {
  const existing = await db.medicine.findFirst({ where: { name: data.name, strength: data.strength ?? null } });
  return existing ?? db.medicine.create({ data });
}

async function seedUsers() {
  const adminEmail = (process.env.ADMIN_EMAILS ?? "admin@bloodapp.local").split(",")[0]!.trim().toLowerCase();
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      role: "ADMIN",
      name: "App Admin",
      gender: "OTHER",
      bloodGroup: "O_POS",
      division: "Dhaka",
      district: "Dhaka",
      dateOfBirth: new Date("1990-01-01T00:00:00+06:00"),
      profileCompleted: true,
    },
  });

  const donors: { phone: string; name: string; gender: Gender; bloodGroup: BloodGroup; thana: string; lat: number; lng: number; dob: string }[] = [
    { phone: "+8801700000001", name: "Rahim Uddin", gender: "MALE", bloodGroup: "O_POS", thana: "Dhanmondi", lat: 23.75, lng: 90.37, dob: "1994-03-12" },
    { phone: "+8801700000002", name: "Nusrat Jahan", gender: "FEMALE", bloodGroup: "A_POS", thana: "Mirpur", lat: 23.81, lng: 90.36, dob: "1997-07-21" },
    { phone: "+8801700000003", name: "Tanvir Ahmed", gender: "MALE", bloodGroup: "B_POS", thana: "Uttara", lat: 23.87, lng: 90.4, dob: "1992-11-02" },
    { phone: "+8801700000004", name: "Farzana Akter", gender: "FEMALE", bloodGroup: "AB_POS", thana: "Gulshan", lat: 23.79, lng: 90.41, dob: "1995-01-30" },
    { phone: "+8801700000005", name: "Sabbir Hossain", gender: "MALE", bloodGroup: "O_NEG", thana: "Mohammadpur", lat: 23.76, lng: 90.36, dob: "1990-05-18" },
    { phone: "+8801700000006", name: "Mitu Rani", gender: "FEMALE", bloodGroup: "B_NEG", thana: "Motijheel", lat: 23.73, lng: 90.42, dob: "1998-09-09" },
    { phone: "+8801700000007", name: "Arif Chowdhury", gender: "MALE", bloodGroup: "A_NEG", thana: "Badda", lat: 23.78, lng: 90.43, dob: "1993-12-25" },
    { phone: "+8801700000008", name: "Sharmin Sultana", gender: "FEMALE", bloodGroup: "AB_NEG", thana: "Tejgaon", lat: 23.76, lng: 90.39, dob: "1996-04-14" },
  ];

  const donorUsers = [];
  for (const d of donors) {
    donorUsers.push(
      await upsertUserByPhone(d.phone, {
        name: d.name,
        gender: d.gender,
        bloodGroup: d.bloodGroup,
        dateOfBirth: new Date(`${d.dob}T00:00:00+06:00`),
        division: "Dhaka",
        district: "Dhaka",
        thana: d.thana,
        contactPhone: d.phone,
        isDonor: true,
        isReceiver: true,
        activeMode: "DONOR",
        isAvailable: true,
        latitude: d.lat,
        longitude: d.lng,
        locationUpdatedAt: new Date(),
        lastDonationAt: daysFromNow(-120),
        profileCompleted: true,
      }),
    );
  }

  // A donor who recently donated and is in the 3-month rest period.
  await upsertUserByPhone("+8801700000009", {
    name: "Kamal Hasan",
    gender: "MALE",
    bloodGroup: "O_POS",
    dateOfBirth: new Date("1991-08-08T00:00:00+06:00"),
    division: "Dhaka",
    district: "Dhaka",
    thana: "Ramna",
    contactPhone: "+8801700000009",
    isDonor: true,
    activeMode: "DONOR",
    isAvailable: false,
    latitude: 23.74,
    longitude: 90.4,
    lastDonationAt: daysFromNow(-20),
    hiddenUntil: daysFromNow(70),
    profileCompleted: true,
  });

  const receiver = await upsertUserByPhone("+8801800000001", {
    name: "Ayesha Siddiqua",
    gender: "FEMALE",
    bloodGroup: "B_POS",
    dateOfBirth: new Date("1988-02-02T00:00:00+06:00"),
    division: "Dhaka",
    district: "Dhaka",
    thana: "Shahbagh",
    contactPhone: "+8801800000001",
    emergencyContactName: "Karim Siddique",
    emergencyContactPhone: "+8801800000002",
    profileCompleted: true,
  });

  const partner = await upsertUserByPhone("+8801900000001", {
    name: "Pharmacy Owner",
    gender: "MALE",
    bloodGroup: "A_POS",
    division: "Dhaka",
    district: "Dhaka",
    contactPhone: "+8801900000001",
    profileCompleted: true,
  });

  return { admin, donorUsers, receiver, partner };
}

async function seedFacilities(partnerOwnerId: string) {
  const base = { division: "Dhaka", district: "Dhaka", isActive: true };
  const list: (Prisma.FacilityUncheckedCreateInput & { type: FacilityType })[] = [
    {
      ...base,
      type: "HOSPITAL",
      name: "Dhaka Medical College Hospital",
      phone: "02-55165088",
      thana: "Shahbagh",
      address: "Secretariat Road, Dhaka 1000",
      latitude: 23.7258,
      longitude: 90.3975,
      is24Hours: true,
      services: ["Emergency", "ICU", "Blood bank", "Burn unit"],
      description: "The largest public tertiary hospital in Bangladesh.",
    },
    {
      ...base,
      type: "HOSPITAL",
      name: "Square Hospitals Ltd.",
      phone: "10616",
      thana: "Panthapath",
      address: "18/F Bir Uttam Qazi Nuruzzaman Sarak, West Panthapath, Dhaka 1205",
      latitude: 23.7529,
      longitude: 90.3816,
      is24Hours: true,
      services: ["Emergency", "ICU", "Cardiology", "Oncology"],
      partnerStatus: "APPROVED",
      discountPercent: 5,
      discountTerms: "5% off on diagnostic services when paid through the app.",
      licenseVerified: true,
    },
    {
      ...base,
      type: "DIAGNOSTIC_CENTER",
      name: "Popular Diagnostic Centre, Dhanmondi",
      phone: "09613787801",
      thana: "Dhanmondi",
      address: "House 16, Road 2, Dhanmondi, Dhaka 1205",
      latitude: 23.7389,
      longitude: 90.3828,
      openingHours: "7am - 10pm",
      services: ["Blood test", "X-ray", "Ultrasound", "MRI"],
      partnerStatus: "APPROVED",
      discountPercent: 10,
      discountTerms: "10% off on all tests for app users. 20% for verified blood donors on request.",
      licenseVerified: true,
    },
    {
      ...base,
      type: "CLINIC",
      name: "Mirpur Family Clinic",
      phone: "01711000111",
      thana: "Mirpur",
      address: "Section 10, Mirpur, Dhaka 1216",
      latitude: 23.8069,
      longitude: 90.3687,
      openingHours: "9am - 9pm",
      services: ["General physician", "Child care", "Vaccination"],
    },
    {
      ...base,
      type: "PHARMACY",
      name: "Lazz Pharma, Kalabagan",
      phone: "01700000100",
      thana: "Kalabagan",
      address: "64/3 Lake Circus, Kalabagan, Dhaka 1205",
      latitude: 23.7495,
      longitude: 90.3815,
      is24Hours: true,
      services: ["Home delivery", "Prescription medicines", "Medical devices"],
      ownerId: partnerOwnerId,
      partnerStatus: "APPROVED",
      discountPercent: 8,
      discountTerms: "8% off on all medicine orders placed in the app.",
      licenseNumber: "DGDA-PH-12345",
      licenseVerified: true,
    },
    {
      ...base,
      type: "AMBULANCE",
      name: "Dhaka 24/7 Ambulance Service",
      phone: "01712000999",
      thana: "Shahbagh",
      address: "Near DMCH, Dhaka",
      latitude: 23.727,
      longitude: 90.396,
      is24Hours: true,
      services: ["AC ambulance", "ICU ambulance", "Freezer van"],
    },
    {
      ...base,
      type: "BLOOD_BANK",
      name: "Quantum Blood Lab",
      phone: "01714010869",
      thana: "Shantinagar",
      address: "31/V Shilpacharya Zainul Abedin Sarak, Shantinagar, Dhaka",
      latitude: 23.7395,
      longitude: 90.4146,
      openingHours: "8am - 10pm",
      services: ["Screened blood", "Platelets", "Plasma"],
    },
    {
      ...base,
      type: "DONATION_CENTER",
      name: "Sandhani DMCH Unit",
      phone: "01819000000",
      thana: "Shahbagh",
      address: "Dhaka Medical College, Dhaka",
      latitude: 23.7262,
      longitude: 90.3978,
      openingHours: "9am - 8pm",
      services: ["Voluntary blood donation", "Blood grouping"],
    },
  ];

  const facilities: Record<string, Awaited<ReturnType<typeof findOrCreateFacility>>> = {};
  for (const item of list) facilities[item.name] = await findOrCreateFacility(item);
  return facilities;
}

async function seedDoctors(hospitalId: string, clinicId: string) {
  const doctors: Prisma.DoctorUncheckedCreateInput[] = [
    {
      name: "Prof. Dr. Mahmuda Khatun",
      speciality: "Haematology",
      qualifications: "MBBS, FCPS (Haematology)",
      facilityId: hospitalId,
      division: "Dhaka",
      district: "Dhaka",
      visitingHours: "Sat-Thu, 4pm - 8pm",
      consultationFee: taka(1500),
      phone: "10616",
    },
    {
      name: "Dr. Shafiqul Islam",
      speciality: "Medicine",
      qualifications: "MBBS, MD (Internal Medicine)",
      facilityId: clinicId,
      division: "Dhaka",
      district: "Dhaka",
      visitingHours: "Daily, 6pm - 10pm",
      consultationFee: taka(800),
      phone: "01711000111",
    },
    {
      name: "Dr. Rumana Haque",
      speciality: "Paediatrics",
      qualifications: "MBBS, DCH",
      chamberName: "Rumana Child Care",
      chamberAddress: "Road 27, Dhanmondi, Dhaka",
      division: "Dhaka",
      district: "Dhaka",
      latitude: 23.7465,
      longitude: 90.3735,
      visitingHours: "Sun-Thu, 5pm - 9pm",
      consultationFee: taka(1000),
    },
  ];
  for (const doctor of doctors) {
    const existing = await db.doctor.findFirst({ where: { name: doctor.name } });
    if (!existing) await db.doctor.create({ data: doctor });
  }
}

async function seedMedicines(pharmacyId: string) {
  const medicines: (Prisma.MedicineCreateInput & { price: number })[] = [
    { name: "Napa", genericName: "Paracetamol", strength: "500 mg", form: "Tablet", manufacturer: "Beximco Pharmaceuticals", usage: "Fever and mild to moderate pain.", sideEffects: "Rare at normal doses. Overdose can damage the liver.", price: 1.2 },
    { name: "Napa Extra", genericName: "Paracetamol + Caffeine", strength: "500 mg + 65 mg", form: "Tablet", manufacturer: "Beximco Pharmaceuticals", usage: "Headache, toothache and other pain.", sideEffects: "Sleeplessness, palpitations.", price: 2.5 },
    { name: "Ace", genericName: "Paracetamol", strength: "500 mg", form: "Tablet", manufacturer: "Square Pharmaceuticals", usage: "Fever and pain relief.", price: 1.2 },
    { name: "Seclo", genericName: "Omeprazole", strength: "20 mg", form: "Capsule", manufacturer: "Square Pharmaceuticals", usage: "Acidity, gastric ulcer and reflux.", sideEffects: "Headache, diarrhoea.", price: 6 },
    { name: "Maxpro", genericName: "Esomeprazole", strength: "20 mg", form: "Tablet", manufacturer: "Renata Limited", usage: "Acid reflux and gastric ulcer.", price: 7 },
    { name: "Fexo", genericName: "Fexofenadine", strength: "120 mg", form: "Tablet", manufacturer: "Square Pharmaceuticals", usage: "Allergy, sneezing and itching.", sideEffects: "Drowsiness (uncommon), headache.", price: 9 },
    { name: "Azithrocin", genericName: "Azithromycin", strength: "500 mg", form: "Tablet", manufacturer: "Beximco Pharmaceuticals", usage: "Bacterial infections (antibiotic).", sideEffects: "Nausea, diarrhoea.", requiresPrescription: true, price: 40 },
    { name: "Monas", genericName: "Montelukast", strength: "10 mg", form: "Tablet", manufacturer: "ACME Laboratories", usage: "Asthma and allergic rhinitis.", requiresPrescription: true, price: 16 },
    { name: "Orsaline-N", genericName: "Oral Rehydration Salts", strength: "10.25 g", form: "Sachet", manufacturer: "SMC", usage: "Dehydration due to diarrhoea or vomiting.", price: 6 },
    { name: "Folison", genericName: "Folic acid", strength: "5 mg", form: "Tablet", manufacturer: "Square Pharmaceuticals", usage: "Folic acid deficiency, anaemia, pregnancy support.", price: 1.5 },
  ];

  for (const { price, ...data } of medicines) {
    const medicine = await findOrCreateMedicine(data);
    await db.pharmacyStock.upsert({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId: medicine.id } },
      update: { price: taka(price) },
      create: { pharmacyId, medicineId: medicine.id, price: taka(price), quantity: 500 },
    });
  }
}

async function seedOffers(facilityIds: string[]) {
  const [pharmacyId, diagnosticId] = facilityIds as [string, string];
  const offers: Prisma.PartnerOfferUncheckedCreateInput[] = [
    { facilityId: pharmacyId, title: "Donor thank-you: 15% off medicines", description: "Verified blood donors get 15% off one medicine order.", code: "DONOR15", minDonations: 1 },
    { facilityId: diagnosticId, title: "Free health check-up", description: "Complete blood count and blood sugar test free after 3 verified donations.", code: "HERO3", minDonations: 3 },
    { facilityId: diagnosticId, title: "Lifesaver package", description: "50% off a full body check-up for donors with 10+ donations.", code: "LIFE10", minDonations: 10 },
  ];
  for (const offer of offers) {
    const existing = await db.partnerOffer.findFirst({ where: { facilityId: offer.facilityId, title: offer.title } });
    if (!existing) await db.partnerOffer.create({ data: offer });
  }
}

async function seedContent(authorId: string) {
  const contents: { slug: string; type: ContentType; language: Language; title: string; summary: string; body: string; eventDate?: Date; location?: string }[] = [
    {
      slug: "who-can-donate-blood",
      type: "DONATION_GUIDE",
      language: "EN",
      title: "Who can donate blood?",
      summary: "Basic eligibility rules for blood donation in Bangladesh.",
      body: "Most healthy adults aged 18 to 60 who weigh at least 50 kg can donate blood.\n\nYou should wait at least 3 months (about 90 days) between whole blood donations. Your haemoglobin should be at a healthy level on the day of donation.\n\nDo not donate if you have a fever, an active infection, recently had a tattoo or surgery, or are pregnant. Always answer the screening questions honestly - they protect both you and the patient.",
    },
    {
      slug: "before-and-after-donation-bn",
      type: "TIP",
      language: "BN",
      title: "রক্তদানের আগে ও পরে করণীয়",
      summary: "নিরাপদ রক্তদানের জন্য কিছু সহজ পরামর্শ।",
      body: "রক্তদানের আগের রাতে ভালোভাবে ঘুমান এবং রক্তদানের আগে হালকা খাবার খান।\n\nপর্যাপ্ত পানি পান করুন। খালি পেটে রক্ত দেবেন না।\n\nরক্তদানের পর অন্তত ১০ মিনিট বিশ্রাম নিন, প্রচুর পানি ও তরল খাবার খান এবং সেদিন ভারী কাজ বা ব্যায়াম এড়িয়ে চলুন।\n\nমাথা ঘোরালে সঙ্গে সঙ্গে শুয়ে পড়ুন এবং পা উঁচু করে রাখুন।",
    },
    {
      slug: "thalassemia-awareness",
      type: "ARTICLE",
      language: "EN",
      title: "Thalassemia: why regular donors matter",
      summary: "Thousands of children in Bangladesh need blood transfusions every month.",
      body: "Thalassemia is an inherited blood disorder. Many patients need a blood transfusion every 2 to 4 weeks for their entire life.\n\nRegular voluntary donors are the safest source of blood for these patients. By donating every 3-4 months you can help keep a child healthy.\n\nCouples can take a simple blood test before marriage to know if they are thalassemia carriers.",
    },
    {
      slug: "dhaka-university-donation-drive",
      type: "DONATION_DRIVE",
      language: "EN",
      title: "Blood donation drive at Dhaka University",
      summary: "Join our voluntary blood donation camp. Free blood grouping for everyone.",
      body: "Our partners are organising a voluntary blood donation camp at TSC, Dhaka University.\n\nBring your NID and have a light meal before coming. Free blood grouping and haemoglobin tests are available for all visitors.",
      eventDate: daysFromNow(14),
      location: "TSC, Dhaka University",
    },
  ];

  for (const c of contents) {
    await db.content.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, published: true, authorId },
    });
  }
}

async function seedRequests(receiverId: string, hospitalId: string) {
  if (await db.bloodRequest.count({ where: { requesterId: receiverId } })) return;
  await db.bloodRequest.createMany({
    data: [
      {
        requesterId: receiverId,
        patientName: "Mother of Ayesha",
        bloodGroup: "B_POS",
        units: 2,
        hospitalName: "Dhaka Medical College Hospital",
        facilityId: hospitalId,
        division: "Dhaka",
        district: "Dhaka",
        thana: "Shahbagh",
        latitude: 23.7258,
        longitude: 90.3975,
        neededBy: daysFromNow(1),
        urgency: "URGENT",
        contactPhone: "+8801800000001",
        notes: "Surgery scheduled for tomorrow morning.",
      },
      {
        requesterId: receiverId,
        patientName: "Accident patient",
        bloodGroup: "O_NEG",
        units: 1,
        hospitalName: "Dhaka Medical College Hospital",
        facilityId: hospitalId,
        division: "Dhaka",
        district: "Dhaka",
        thana: "Shahbagh",
        latitude: 23.7258,
        longitude: 90.3975,
        neededBy: new Date(Date.now() + 3 * 60 * 60 * 1000),
        urgency: "CRITICAL",
        isEmergency: true,
        contactPhone: "+8801800000001",
        notes: "Emergency ward, bed 12.",
      },
    ],
  });
}

async function main() {
  const { admin, receiver, partner } = await seedUsers();
  const facilities = await seedFacilities(partner.id);
  const hospital = facilities["Dhaka Medical College Hospital"]!;
  const clinic = facilities["Mirpur Family Clinic"]!;
  const pharmacy = facilities["Lazz Pharma, Kalabagan"]!;
  const diagnostic = facilities["Popular Diagnostic Centre, Dhanmondi"]!;

  await seedDoctors(hospital.id, clinic.id);
  await seedMedicines(pharmacy.id);
  await seedOffers([pharmacy.id, diagnostic.id]);
  await seedContent(admin.id);
  await seedRequests(receiver.id, hospital.id);

  console.log("Seed complete.");
  console.log(`Admin: ${admin.email} (sign in with email OTP)`);
  console.log("Demo receiver: 01800000001 · demo donors: 01700000001-01700000009 · pharmacy partner: 01900000001");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
