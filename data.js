// EcoLife Carbon Tracker - Data Model

export const QUIZ_QUESTIONS = [
  {
    id: "housing_size",
    category: "housing",
    question: "What type of home do you live in?",
    options: [
      { text: "Detached house / Large home", value: 3000, desc: "Higher heating and cooling requirements" },
      { text: "Semi-detached or terraced house", value: 2000, desc: "Shared walls reduce heat loss" },
      { text: "Apartment / Condo", value: 1200, desc: "Efficient shared building energy profile" },
      { text: "Tiny home / Micro-apartment", value: 600, desc: "Very low spatial energy footprint" }
    ]
  },
  {
    id: "housing_energy",
    category: "housing",
    question: "What is your primary household energy source?",
    options: [
      { text: "Coal/Gas electricity and gas heating", value: 2800, desc: "High fossil-fuel reliance" },
      { text: "Standard grid electricity & heating mix", value: 1800, desc: "Average grid carbon intensity" },
      { text: "Electric heating with heat pump & clean grid", value: 800, desc: "Highly efficient electrical heating" },
      { text: "100% Renewable / Solar powered", value: 150, desc: "Near-zero operational emissions" }
    ]
  },
  {
    id: "transport_vehicle",
    category: "transport",
    question: "How do you primary commute or travel locally?",
    options: [
      { text: "Petrol or diesel car (alone)", value: 3500, desc: "High combustion engine emissions" },
      { text: "Hybrid car or carpool", value: 1800, desc: "Improved mileage or shared footprint" },
      { text: "Electric Vehicle (EV)", value: 800, desc: "Zero tailpipe emissions, grid dependent" },
      { text: "Public Transit (bus, train, subway)", value: 400, desc: "Efficient mass transportation" },
      { text: "Walk, bicycle, or micromobility", value: 0, desc: "Zero carbon transportation" }
    ]
  },
  {
    id: "transport_flights",
    category: "transport",
    question: "How many hours of flight do you take per year?",
    options: [
      { text: "None (I don't fly)", value: 0, desc: "Excellent, zero aviation impact" },
      { text: "1 to 5 hours (Occasional domestic)", value: 600, desc: "Around 1 short-haul round trip" },
      { text: "5 to 15 hours (Moderate travel)", value: 1800, desc: "Multiple short trips or one long-haul trip" },
      { text: "15+ hours (Frequent flyer)", value: 4500, desc: "Significant aviation footprint" }
    ]
  },
  {
    id: "diet_type",
    category: "food",
    question: "Which option best describes your daily diet?",
    options: [
      { text: "High meat consumer (almost every meal)", value: 2800, desc: "High beef/lamb consumption has massive impact" },
      { text: "Average meat eater (occasional meat)", value: 1900, desc: "Standard mixed diet" },
      { text: "Vegetarian (no meat, but eat dairy/eggs)", value: 1200, desc: "Lower impact, dairy still carries carbon" },
      { text: "Vegan (strictly plant-based)", value: 700, desc: "Lowest carbon diet possible" }
    ]
  },
  {
    id: "food_waste",
    category: "food",
    question: "How much of the food you buy gets thrown away?",
    options: [
      { text: "Frequently throw away leftovers/spoiled food", value: 600, desc: "High waste multiplies food production impact" },
      { text: "Occasionally throw away food", value: 300, desc: "Average household waste" },
      { text: "Rarely/Never throw away food (compost leftovers)", value: 50, desc: "Minimal food waste" }
    ]
  },
  {
    id: "consumption_habits",
    category: "consumption",
    question: "How often do you buy new electronics, clothes, and home goods?",
    options: [
      { text: "Regularly buy new trends and latest gadgets", value: 2500, desc: "High manufacturing and shipping emissions" },
      { text: "Only buy when items break or are needed", value: 1200, desc: "Standard consumer cycle" },
      { text: "Mainly buy second-hand, repair, and recycle", value: 400, desc: "Circular economy approach" }
    ]
  }
];

export const DAILY_ACTIONS = [
  {
    id: "plant_based_meal",
    category: "food",
    title: "Eat plant-based meals",
    impact: 4.5,
    difficulty: "Easy",
    points: 15,
    icon: "🥗"
  },
  {
    id: "bike_walk",
    category: "transport",
    title: "Commute by bike or walk",
    impact: 3.2,
    difficulty: "Medium",
    points: 25,
    icon: "🚲"
  },
  {
    id: "public_transit",
    category: "transport",
    title: "Use public transport",
    impact: 2.5,
    difficulty: "Easy",
    points: 15,
    icon: "🚌"
  },
  {
    id: "unplug_unused",
    category: "housing",
    title: "Unplug standby electronics",
    impact: 0.6,
    difficulty: "Easy",
    points: 5,
    icon: "🔌"
  },
  {
    id: "cold_wash",
    category: "housing",
    title: "Cold-water laundry cycle",
    impact: 1.2,
    difficulty: "Easy",
    points: 10,
    icon: "👕"
  },
  {
    id: "line_dry",
    category: "housing",
    title: "Hang dry laundry",
    impact: 1.8,
    difficulty: "Easy",
    points: 12,
    icon: "☀️"
  },
  {
    id: "short_shower",
    category: "housing",
    title: "Under 5-minute shower",
    impact: 1.5,
    difficulty: "Medium",
    points: 15,
    icon: "🚿"
  },
  {
    id: "zero_waste_day",
    category: "consumption",
    title: "Zero waste day (no plastic/trash)",
    impact: 2.0,
    difficulty: "Hard",
    points: 30,
    icon: "♻️"
  },
  {
    id: "thermostat_tweak",
    category: "housing",
    title: "Tweak thermostat by 1°C",
    impact: 1.4,
    difficulty: "Easy",
    points: 10,
    icon: "🌡️"
  },
  {
    id: "reusable_bottles",
    category: "consumption",
    title: "Use reusable cup/bag/bottle",
    impact: 0.8,
    difficulty: "Easy",
    points: 8,
    icon: "🥤"
  }
];

export const PERSONALIZED_INSIGHTS = {
  housing: [
    {
      minEmissions: 2000,
      title: "Optimize Home Heating and Cooling",
      recommendation: "Your home energy emissions are high. Consider installing a smart programmable thermostat to lower heating/cooling when you are asleep or away. Sealing air leaks around doors and windows can cut energy loss by up to 15%."
    },
    {
      minEmissions: 1000,
      title: "Transition to Clean Energy",
      recommendation: "If you haven't already, look into local community solar programs or ask your electricity provider for a green power plan. This can immediately zero out your electric emissions without installing physical panels."
    }
  ],
  transport: [
    {
      minEmissions: 3000,
      title: "Reduce Solo Car Trips",
      recommendation: "Solo driving is your largest transport emission source. Try to bundle errands together, carpool with coworkers, or replace one car trip per week with a bicycle, walk, or public transit option."
    },
    {
      minEmissions: 1500,
      title: "Aviation Emissions Tactic",
      recommendation: "Frequent flights are highly carbon-intensive. For travel under 400 miles, consider taking a train or high-speed bus. For business, try virtual meetings, or consider carbon offsets as a last resort."
    }
  ],
  food: [
    {
      minEmissions: 2000,
      title: "Introduce Meatless Mondays",
      recommendation: "Beef and lamb have a carbon footprint 10-30x higher than plant-based proteins. Swapping meat for lentils, beans, or tofu even just 2 days a week makes a dramatic difference."
    },
    {
      minEmissions: 400,
      title: "Smart Meal Planning",
      recommendation: "Food waste decomposing in landfills creates methane. Plan your grocery lists in advance, freeze excess food before it spoils, and compost organic scraps to return nutrients to the soil."
    }
  ],
  consumption: [
    {
      minEmissions: 1500,
      title: "Embrace the Circular Economy",
      recommendation: "Purchasing new goods drives manufacturing carbon emissions. Try a 'buy nothing' month, search local thrift shops, or use online marketplaces for second-hand electronics and furniture."
    }
  ]
};
