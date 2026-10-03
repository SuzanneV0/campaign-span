/* Campaign Span — demo environment definitions, shared by the demo app and the admin console.
   An environment is a small JSON config. It travels inside the demo link (?env=...), so a
   custom demo works on any device without a server. */
(function () {
  'use strict';

  var DEPTS = ['Production', 'Social', 'Brand services', 'Sales', 'Marketing'];
  var CHANNELS = {
    instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', facebook: 'Facebook',
    threads: 'Threads', bluesky: 'Bluesky', linkedin: 'LinkedIn', pinterest: 'Pinterest', email: 'Email'
  };

  // Shared production kit used by every industry's shoot
  var KIT = [
    { name: 'Sony FX3 camera body', qty: 2, status: 'Packed' },
    { name: '24–70mm f/2.8 lens', qty: 1, status: 'Packed' },
    { name: '85mm f/1.4 lens', qty: 1, status: 'Needed' },
    { name: 'DJI RS 4 gimbal', qty: 1, status: 'Checked out' },
    { name: 'Aputure 600d + softbox', qty: 2, status: 'Checked out' },
    { name: 'V-mount batteries', qty: 6, status: 'Packed' },
    { name: 'Wireless lav mics', qty: 2, status: 'Needed' }
  ];

  // Roles in `future` and `schedule`: S social lead, M marketing, P production, P2 second production, B brand, X sales
  var INDUSTRIES = {
    apparel: {
      label: 'Fashion & apparel',
      titles: {
        instagram: ['Product carousel', 'Customer spotlight Reel', 'Behind the scenes Story', 'Styling tips Reel', 'UGC repost', 'Weekend mood board'],
        tiktok: ['Trend remix', 'Day in the life', 'Packing orders', 'Founder Q&A clip', 'Get ready with me'],
        youtube: ['How it’s made', 'Monthly vlog', 'Studio tour'],
        x: ['Launch countdown', 'Industry hot take', 'Q&A thread'],
        facebook: ['Event recap album', 'Community poll', 'Store hours update'],
        threads: ['Behind the brand thread', 'Ask us anything'],
        bluesky: ['Creator spotlight', 'Sneak peek'],
        linkedin: ['Hiring post', 'Team milestone', 'Case study'],
        pinterest: ['Styling boards', 'Outfit pins', 'Seasonal palette pins'],
        email: ['Weekly newsletter', 'New arrivals email', 'VIP early access', 'Restock alert']
      },
      future: ['Fall drop teaser', 'Newsletter #41', 'Studio day BTS', 'Fall lookbook film', 'Launch carousel', 'Launch thread', 'Launch email', 'Live Q&A',
        'Launch event recap', 'Customer case study', 'Gift guide pins', 'Gift guide Reel', 'Holiday gift guide', 'Holiday trend remix', 'Creator spotlight', 'Holiday countdown'],
      project: {
        name: 'Fall Lookbook Shoot',
        brief: 'Capture the Fall collection in a warm, lived-in studio setting. Footage feeds the launch film, carousel, TikTok BTS and launch email hero.',
        goals: ['Deliver 4 hero looks as stills, Reels and a 90-second film', 'Grow launch-week reach 25% over the Spring launch', 'Build a reusable library of 60+ approved selects'],
        audience: 'Style-conscious 22–38 year olds who shop new drops on mobile.',
        location: 'Studio B, 214 Mercer St (loading dock on Mercer)',
        talent: '3 models, booked and contracts signed',
        budget: '$8,500 (studio $2,200 · talent $3,600 · crew $2,100 · misc $600)',
        schedule: [['08:00', 'Crew call and load-in', 'P'], ['09:00', 'Hair, makeup and wardrobe', 'B'], ['09:30', 'Looks 1–4: hero stills', 'P2'], ['12:30', 'Lunch', ''],
          ['13:30', 'Lookbook film: gimbal walk-throughs', 'P'], ['15:30', 'BTS for TikTok and Stories', 'S'], ['17:30', 'Wrap and strike', 'P']],
        // Call sheet: outside crew and talent [name, role, Crew|Talent, call, wrap, status]
        callSheet: [['Jamie Ortiz', 'Gaffer', 'Crew', '08:00', '18:00'], ['Priya Nair', 'Stylist', 'Crew', '08:30', '17:30'], ['Chloe Martin', 'Hair and makeup', 'Crew', '08:30', '15:30'],
          ['Ava Laurent', 'Model, looks 1–2', 'Talent', '09:00', '14:00'], ['Noah Kim', 'Model, looks 3–4', 'Talent', '09:00', '16:00', 'Pending'], ['Zara Ellis', 'Model, lookbook film', 'Talent', '12:30', '16:00']]
      }
    },
    saas: {
      label: 'Software & SaaS',
      titles: {
        instagram: ['Feature tip carousel', 'Team culture Reel', 'Customer quote card', 'Office tour Story'],
        tiktok: ['60-second feature demo', 'Day in the life of an engineer', 'Myth vs fact', 'Customer reaction'],
        youtube: ['Product walkthrough', 'Webinar replay', 'Customer story film'],
        x: ['Changelog thread', 'Industry hot take', 'Release notes'],
        facebook: ['Webinar invite', 'Community spotlight', 'Event recap'],
        threads: ['Build in public update', 'Ask us anything'],
        bluesky: ['Engineering blog share', 'Release notes'],
        linkedin: ['Customer case study', 'Hiring post', 'Thought leadership article', 'Product update'],
        pinterest: ['Infographic pins', 'Template pins'],
        email: ['Product newsletter', 'Feature announcement', 'Onboarding tips', 'Webinar invite']
      },
      future: ['v4.0 teaser', 'Product newsletter #18', 'Launch video BTS', 'v4.0 launch film', 'Feature carousel', 'Launch thread', 'Launch email', 'Live product Q&A',
        'Launch webinar recap', 'Customer case study', 'Template pins', 'Feature tip Reel', 'Year-end product roundup', 'Engineer explainer', 'Community spotlight', 'Year in review'],
      project: {
        name: 'v4.0 Launch Video Shoot',
        brief: 'Film the v4.0 launch video and customer testimonials in our office. Footage feeds the launch film, feature clips, social cut-downs and launch email.',
        goals: ['Deliver a 2-minute launch film and 6 feature clips', 'Drive 1,500 trial sign-ups in launch week', 'Capture 3 customer testimonials for Sales'],
        audience: 'Operations and marketing leads at 50–500 person companies.',
        location: 'Head office, 4th floor studio room',
        talent: '2 customers on site, 1 on-camera product lead',
        budget: '$6,200 (crew $3,400 · equipment $1,300 · travel $900 · misc $600)',
        schedule: [['08:30', 'Crew call and set build', 'P'], ['09:30', 'Product lead interview', 'P2'], ['11:00', 'Screen-capture B-roll', 'P'], ['12:30', 'Lunch', ''],
          ['13:30', 'Customer testimonials', 'P'], ['15:30', 'Social cut-down clips', 'S'], ['17:00', 'Wrap and strike', 'P']],
        callSheet: [['Jamie Ortiz', 'Gaffer', 'Crew', '08:30', '17:30'], ['Lee Chang', 'Sound recordist', 'Crew', '08:30', '17:00'],
          ['Morgan Hale', 'Product lead, on camera', 'Talent', '09:00', '11:00'], ['Dana Whitfield', 'Customer testimonial', 'Talent', '13:00', '14:30'], ['Sam Okafor', 'Customer testimonial', 'Talent', '13:45', '15:30', 'Pending']]
      }
    },
    food: {
      label: 'Restaurants & hospitality',
      titles: {
        instagram: ['Dish of the day', 'Chef’s table Reel', 'Behind the pass Story', 'Guest photo repost', 'Weekend brunch carousel'],
        tiktok: ['Recipe in 30 seconds', 'Kitchen day in the life', 'Plating ASMR', 'Staff picks'],
        youtube: ['Chef masterclass', 'Farm-to-table film', 'Kitchen tour'],
        x: ['Tonight’s specials', 'Reservation reminder', 'Event announcement'],
        facebook: ['Event invite', 'Community poll', 'Holiday hours'],
        threads: ['Chef’s notes', 'Ask the sommelier'],
        bluesky: ['Supplier spotlight', 'Sneak peek'],
        linkedin: ['Hiring post', 'Supplier partnership', 'Team milestone'],
        pinterest: ['Recipe pins', 'Table setting boards', 'Seasonal menu pins'],
        email: ['Weekly specials', 'Event invite', 'Loyalty rewards', 'Holiday booking reminder']
      },
      future: ['Fall menu teaser', 'Weekly specials #41', 'Menu shoot BTS', 'Fall menu film', 'New menu carousel', 'Chef’s notes thread', 'Fall menu launch email', 'Live tasting Q&A',
        'Launch night recap', 'Supplier spotlight', 'Holiday table pins', 'Holiday dinner Reel', 'Holiday booking reminder', 'Holiday recipe remix', 'Staff spotlight', 'Holiday countdown'],
      project: {
        name: 'Fall Menu Shoot',
        brief: 'Photograph and film the new Fall menu in the dining room at golden hour. Footage feeds the menu film, launch carousel, recipe clips and launch email.',
        goals: ['Shoot all 12 new dishes as stills and short clips', 'Fill 85% of launch-week reservations', 'Build a library of seasonal assets for the holidays'],
        audience: 'Local diners aged 25–55 who book online.',
        location: 'Main dining room (closed to guests until 4 PM)',
        talent: 'Head chef and 2 servers',
        budget: '$4,800 (crew $2,600 · food $900 · props $700 · misc $600)',
        schedule: [['07:30', 'Crew call and load-in', 'P'], ['08:30', 'Kitchen prep for dishes 1–6', 'B'], ['09:00', 'Dishes 1–6: hero stills', 'P2'], ['12:00', 'Staff lunch', ''],
          ['13:00', 'Chef film: plating sequences', 'P'], ['14:30', 'BTS for TikTok and Stories', 'S'], ['15:45', 'Wrap and reset dining room', 'P']],
        callSheet: [['Jamie Ortiz', 'Gaffer', 'Crew', '07:30', '16:15'], ['Ellie Park', 'Food stylist', 'Crew', '07:30', '14:30'],
          ['Marco Bellini', 'Head chef', 'Talent', '07:30', '15:00'], ['Rosa Diaz', 'Server', 'Talent', '12:30', '15:00'], ['Ben Carter', 'Server', 'Talent', '12:30', '15:00', 'Pending']]
      }
    },
    nonprofit: {
      label: 'Nonprofit',
      titles: {
        instagram: ['Impact story carousel', 'Volunteer spotlight Reel', 'Behind the scenes Story', 'Donor thank-you'],
        tiktok: ['Day with a volunteer', 'Myth vs fact', 'Impact in 60 seconds'],
        youtube: ['Impact film', 'Program explainer', 'Annual report video'],
        x: ['Advocacy thread', 'Event announcement', 'Campaign update'],
        facebook: ['Fundraiser invite', 'Community poll', 'Event recap album'],
        threads: ['Ask our team anything', 'Campaign update'],
        bluesky: ['Partner spotlight', 'Research share'],
        linkedin: ['Partner announcement', 'Volunteer call', 'Annual impact report'],
        pinterest: ['Infographic pins', 'Volunteer guide pins'],
        email: ['Monthly newsletter', 'Donation appeal', 'Event invite', 'Volunteer update']
      },
      future: ['Giving Tuesday teaser', 'Newsletter #41', 'Impact film BTS', 'Giving Tuesday film', 'Impact carousel', 'Campaign thread', 'Donation appeal email', 'Live Q&A with founders',
        'Fundraiser recap', 'Partner announcement', 'Infographic pins', 'Volunteer Reel', 'Year-end appeal', 'Impact in 60 seconds', 'Volunteer spotlight', 'Year in review'],
      project: {
        name: 'Giving Tuesday Film Shoot',
        brief: 'Film volunteers and families at the community centre for the Giving Tuesday campaign. Footage feeds the campaign film, impact carousel, short clips and appeal email.',
        goals: ['Deliver a 90-second campaign film and 5 short clips', 'Raise $60,000 on Giving Tuesday', 'Recruit 40 new monthly donors'],
        audience: 'Past donors and local supporters aged 30–65.',
        location: 'Riverside Community Centre, main hall',
        talent: '4 volunteers and 2 families (consent forms signed)',
        budget: '$3,500 (crew $2,200 · equipment $700 · catering $300 · misc $300)',
        schedule: [['09:00', 'Crew call and load-in', 'P'], ['10:00', 'Volunteer interviews', 'P2'], ['11:30', 'Program B-roll', 'P'], ['12:30', 'Lunch', ''],
          ['13:30', 'Family stories', 'P'], ['15:00', 'BTS for TikTok and Stories', 'S'], ['16:30', 'Wrap and strike', 'P']],
        callSheet: [['Lee Chang', 'Sound recordist', 'Crew', '09:00', '17:00'], ['Grace Thompson', 'Volunteer interview', 'Talent', '09:45', '11:30'],
          ['Omar Haddad', 'Volunteer interview', 'Talent', '10:30', '12:00'], ['The Martin family', 'Family story', 'Talent', '13:15', '14:30'], ['The Singh family', 'Family story', 'Talent', '14:00', '15:00', 'Pending']]
      }
    }
  };

  var DEFAULT = {
    v: 1,
    company: 'Northwind Apparel',
    industry: 'apparel',
    purpose: 'sales',
    color: '#D90368',
    data: 'full',
    channels: Object.keys(CHANNELS),
    people: [
      { name: 'Maya Chen', dept: 'Social' }, { name: 'Jordan Reyes', dept: 'Marketing' }, { name: 'Dev Patel', dept: 'Production' },
      { name: 'Avery Kim', dept: 'Production' }, { name: 'Sam Lee', dept: 'Brand services' }, { name: 'Taylor Wright', dept: 'Sales' }
    ],
    notify: { Production: 'aes', Social: 'aes', 'Brand services': 'aes', Sales: 'ae', Marketing: 'aes' },
    banner: '',
    excel: true
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Fill gaps and drop anything unexpected, so a hand-edited or old link still loads.
  function normalize(cfg) {
    var out = clone(DEFAULT);
    if (!cfg || typeof cfg !== 'object') return out;
    if (typeof cfg.company === 'string' && cfg.company.trim()) out.company = cfg.company.trim().slice(0, 60);
    if (INDUSTRIES[cfg.industry]) out.industry = cfg.industry;
    if (cfg.purpose === 'onboarding' || cfg.purpose === 'sales') out.purpose = cfg.purpose;
    if (/^#[0-9a-f]{6}$/i.test(cfg.color || '')) out.color = cfg.color;
    if (['full', 'light', 'empty'].indexOf(cfg.data) !== -1) out.data = cfg.data;
    if (Array.isArray(cfg.channels)) {
      var ch = cfg.channels.filter(function (c) { return CHANNELS[c]; });
      if (ch.length) out.channels = ch;
    }
    if (Array.isArray(cfg.people)) {
      var ppl = cfg.people.filter(function (p) { return p && typeof p.name === 'string' && p.name.trim() && DEPTS.indexOf(p.dept) !== -1; })
        .slice(0, 20).map(function (p) { return { name: p.name.trim().slice(0, 40), dept: p.dept }; });
      if (ppl.length) out.people = ppl;
    }
    if (cfg.notify && typeof cfg.notify === 'object') {
      DEPTS.forEach(function (d) { if (typeof cfg.notify[d] === 'string') out.notify[d] = cfg.notify[d].replace(/[^aes]/g, ''); });
    }
    if (typeof cfg.banner === 'string') out.banner = cfg.banner.slice(0, 140);
    if (typeof cfg.excel === 'boolean') out.excel = cfg.excel;
    return out;
  }

  // Unicode-safe base64url
  function encode(cfg) {
    var json = JSON.stringify(normalize(cfg));
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    var b = String(str).trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  }
  function fromUrl(href) {
    var m = String(href || location.href).match(/[?&]env=([^&#]+)/);
    return m ? m[1] : null;
  }

  window.CSEnv = {
    DEPTS: DEPTS, CHANNELS: CHANNELS, INDUSTRIES: INDUSTRIES, KIT: KIT,
    DEFAULT: DEFAULT, normalize: normalize, encode: encode, decode: decode, fromUrl: fromUrl, clone: clone
  };
})();
