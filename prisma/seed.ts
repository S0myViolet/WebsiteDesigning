// Seeds the database with FICTIONAL sample businesses so the dashboard can be
// explored without Google/OpenAI API keys. All names, reviews, and details are
// invented for demo purposes and do not refer to real businesses.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const samples = [
  {
    placeId: "seed-marina-glow-beauty",
    name: "Marina Glow Beauty Lounge (Sample)",
    category: "Salons",
    area: "Dubai Marina",
    address: "Marina Walk, Dubai Marina, Dubai (sample data)",
    phone: "+971 4 000 0001",
    rating: 4.7,
    reviewCount: 182,
    websiteStatus: "NO_WEBSITE_LISTED",
    googleMapsUrl: "https://maps.google.com/?q=Dubai+Marina",
    openingHours: JSON.stringify([
      "Monday: 10:00 AM – 9:00 PM",
      "Tuesday: 10:00 AM – 9:00 PM",
      "Wednesday: 10:00 AM – 9:00 PM",
      "Thursday: 10:00 AM – 10:00 PM",
      "Friday: 10:00 AM – 10:00 PM",
      "Saturday: 10:00 AM – 10:00 PM",
      "Sunday: 12:00 PM – 8:00 PM",
    ]),
    editorialSummary:
      "Neighborhood beauty salon offering hair coloring, nail care, and facials.",
    reviews: [
      { text: "Best balayage I've had in Dubai. The colorist really listened to what I wanted and the result was perfect. Booking an appointment was easy over the phone.", rating: 5, reviewerName: "Sample Reviewer A" },
      { text: "Clean, relaxing place. I come every month for gel nails and the staff are always friendly. Prices are fair for Marina.", rating: 5, reviewerName: "Sample Reviewer B" },
      { text: "Great blowout before an event, though I wish I could see their price list and services online somewhere.", rating: 4, reviewerName: "Sample Reviewer C" },
      { text: "The facial was lovely and the interior is spotless. Would recommend to anyone in the Marina area.", rating: 5, reviewerName: "Sample Reviewer D" },
    ],
  },
  {
    placeId: "seed-alquoz-auto-care",
    name: "Al Quoz Auto Care Center (Sample)",
    category: "Car garages",
    area: "Al Quoz",
    address: "Al Quoz Industrial Area 3, Dubai (sample data)",
    phone: "+971 4 000 0002",
    rating: 4.6,
    reviewCount: 315,
    websiteStatus: "NO_WEBSITE_LISTED",
    googleMapsUrl: "https://maps.google.com/?q=Al+Quoz",
    openingHours: JSON.stringify([
      "Monday: 8:00 AM – 8:00 PM",
      "Tuesday: 8:00 AM – 8:00 PM",
      "Wednesday: 8:00 AM – 8:00 PM",
      "Thursday: 8:00 AM – 8:00 PM",
      "Friday: 8:00 AM – 12:00 PM",
      "Saturday: 8:00 AM – 8:00 PM",
      "Sunday: Closed",
    ]),
    editorialSummary: null,
    reviews: [
      { text: "Honest mechanics, fair prices. They diagnosed my AC issue quickly and sent me a quote on WhatsApp before starting work.", rating: 5, reviewerName: "Sample Reviewer E" },
      { text: "Did a full service and brake pads on my SUV. Good communication and the car was ready same day.", rating: 5, reviewerName: "Sample Reviewer F" },
      { text: "Decent garage. Busy on weekends so call ahead for an appointment.", rating: 4, reviewerName: "Sample Reviewer G" },
      { text: "They explained everything before charging me. Rare to find a transparent garage in Dubai.", rating: 5, reviewerName: "Sample Reviewer H" },
    ],
  },
  {
    placeId: "seed-mirdif-little-steps",
    name: "Little Steps Nursery Mirdif (Sample)",
    category: "Nurseries",
    area: "Mirdif",
    address: "Uptown Mirdif, Dubai (sample data)",
    phone: "+971 4 000 0003",
    rating: 4.8,
    reviewCount: 96,
    websiteStatus: "LIKELY_MISSING",
    googleMapsUrl: "https://maps.google.com/?q=Mirdif",
    openingHours: JSON.stringify([
      "Monday: 7:30 AM – 6:00 PM",
      "Tuesday: 7:30 AM – 6:00 PM",
      "Wednesday: 7:30 AM – 6:00 PM",
      "Thursday: 7:30 AM – 6:00 PM",
      "Friday: 7:30 AM – 12:30 PM",
      "Saturday: Closed",
      "Sunday: Closed",
    ]),
    editorialSummary: null,
    reviews: [
      { text: "Wonderful, caring teachers. My daughter settled in within a week and loves going every morning. Communication with parents is excellent.", rating: 5, reviewerName: "Sample Reviewer I" },
      { text: "Clean facilities and a lovely outdoor play area. I wanted to see their curriculum and fees online before visiting but couldn't find a website — worth calling them though.", rating: 4, reviewerName: "Sample Reviewer J" },
      { text: "The staff genuinely care about the kids. Regular photo updates during the day are so reassuring.", rating: 5, reviewerName: "Sample Reviewer K" },
    ],
  },
];

async function main() {
  for (const s of samples) {
    const { reviews, ...business } = s;
    const created = await prisma.business.upsert({
      where: { placeId: business.placeId },
      create: {
        ...business,
        photosCount: 0,
        rawPlaceData: JSON.stringify({ source: "seed", note: "Fictional sample data" }),
      },
      update: {},
    });
    const existing = await prisma.review.count({ where: { businessId: created.id } });
    if (existing === 0) {
      await prisma.review.createMany({
        data: reviews.map((r) => ({
          businessId: created.id,
          reviewText: r.text,
          reviewRating: r.rating,
          reviewerName: r.reviewerName,
          reviewDate: "2026-05-01",
        })),
      });
    }
  }
  console.log(`Seeded ${samples.length} fictional sample businesses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
