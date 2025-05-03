import { Logo } from "@/once-ui/components";

const person = {
  firstName: "Samer",
  lastName: "Aslan",
  get name() {
    return `${this.firstName} ${this.lastName}`;
  },
  role: "Software Engineer",
  avatar: "/images/avatar.jpg",
  email: "samer.aslan@gmail.com",
  location: "America/New_York",
  languages: ["English", "Arabic", "French", "Mandarin"],
};

const newsletter = {
  display: true,
  title: <>Subscribe to {person.firstName}'s Newsletter</>,
  description: (
    <>
      I occasionally write about software engineering, machine learning, and share thoughts on the intersection of
      technology and human experience.
    </>
  ),
};

const social = [
  {
    name: "GitHub",
    icon: "github",
    link: "https://github.com/sameraslan",
  },
  {
    name: "LinkedIn",
    icon: "linkedin",
    link: "https://www.linkedin.com/in/sameraslan",
  },
  {
    name: "Email",
    icon: "email",
    link: `mailto:${person.email}`,
  },
];

const home = {
  path: "/",
  image: "/images/og/home.jpg",
  label: "Home",
  title: `${person.name}'s Portfolio`,
  description: `Portfolio website showcasing my work as a ${person.role} specializing in full-stack development and machine learning`,
  headline: <>Samer Aslan</>,
  featured: {
    display: true,
    title: <>Recent project: <strong className="ml-4">Luigi GPT</strong></>,
    href: "/work/luigi-gpt",
  },
  subline: (
    <>
      I'm Samer. I write code, listen to music, and ponder about random things.
    </>
  ),
};

const about = {
  path: "/about",
  label: "About",
  title: `About – ${person.name}`,
  description: `Meet ${person.name}, ${person.role} from ${person.location}`,
  tableOfContent: {
    display: true,
    subItems: false,
  },
  avatar: {
    display: true,
  },
  calendar: {
    display: true,
    link: "https://cal.com/sameraslan",
  },
  intro: {
    display: true,
    title: "Introduction",
    description: (
      <>
        Hi, I'm Samer, a Software Engineer with experience in full-stack development and machine learning. 
        I'm passionate about applying my engineering and software knowledge to develop innovative solutions 
        that create meaningful and positive experiences for people.

        My non-tech interests span across multiple disciplines, including:
        - Human psychology and behavior
        - The brain and its role in sensation and perception
        - Art, with a particular focus on music and its influence on cognition
        - The intersection of nutrition and human well-being

        I'm especially excited about how these diverse fields can intersect with technology to enhance the human experience.
      </>
    ),
  },
  work: {
    display: true,
    title: "Work Experience",
    experiences: [
      {
        company: "Bloomberg LP",
        timeframe: "Feb 2024 - Present",
        role: "Software Engineer",
        achievements: [
          <>
            Revamped the data ingestion pipeline for Bloomberg currencies, 5x'ing throughput for 300,000+ terminal users
          </>,
          <>
            Led the development of a price config platform for 250+ daily users, working closely with product for delivery
          </>,
          <>
            Built LLM guardrails for Bloomberg Law, ensuring chatbot interactions are safe for 100,000+ attorneys
          </>,
        ],
        images: [],
      },
      {
        company: "JHU Center for Language and Speech Processing",
        timeframe: "May 2023 - Jan 2024",
        role: "Machine Learning Researcher",
        achievements: [
          <>
            Produced DiaLong, a novel dataset of long dialogues, and a memory evaluation framework for LLMs
          </>,
          <>
            Created an enhanced memory model using summarization to improve LLM performance on established metrics
          </>,
        ],
        images: [],
      },
      {
        company: "JHU Dynamic Perception Lab",
        timeframe: "Jan 2023 - Dec 2023",
        role: "Machine Learning Researcher",
        achievements: [
          <>
            Developed ML models mimicking human multisensory perception for temporal alignment of audio-visual stimuli
          </>,
          <>
            Designed a novel loss function, improving temporal alignment of visual and auditory stimuli, mimicking perception
          </>,
        ],
        images: [],
      },
    ],
  },
  studies: {
    display: true,
    title: "Education",
    institutions: [
      {
        name: "Johns Hopkins University",
        description: <>Master's in Computer Science, GPA 4.0/4.0</>,
      },
      {
        name: "Johns Hopkins University",
        description: <>Bachelor's in Computer Science, Computer Engineering, & Cognitive Science</>,
      },
    ],
  },
  technical: {
    display: true,
    title: "Technical Skills",
    skills: [
      {
        title: "Programming Languages",
        description: <>Python, JavaScript/TypeScript, C, C++, Java, SQL, HTML, CSS, MATLAB, Dart</>,
        images: [],
      },
      {
        title: "Frameworks & Tools",
        description: <>PyTorch, Hugging Face, React, Next.js, Node.js, Docker, Flask, PostgreSQL, scikit-learn, Stable Diffusion, PyTest, Prisma, Flutter</>,
        images: [],
      },
    ],
  },
};

const blog = {
  path: "/blog",
  label: "Blog",
  title: "Writing about design and tech...",
  description: `Read what ${person.name} has been up to recently`,
  // Create new blog posts by adding a new .mdx file to app/blog/posts
  // All posts will be listed on the /blog route
};

const work = {
  path: "/work",
  label: "Work",
  title: `Projects – ${person.name}`,
  description: `Design and dev projects by ${person.name}`,
  // Create new project pages by adding a new .mdx file to app/blog/posts
  // All projects will be listed on the /home and /work routes
};

const gallery = {
  path: "/gallery",
  label: "Gallery",
  title: `Photo gallery – ${person.name}`,
  description: `A photo collection by ${person.name}`,
  // Images by https://lorant.one
  // These are placeholder images, replace with your own
  images: [
    {
      src: "/images/gallery/horizontal-1.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/horizontal-2.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/horizontal-3.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/horizontal-4.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/vertical-1.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/vertical-2.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/vertical-3.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/vertical-4.jpg",
      alt: "image",
      orientation: "vertical",
    },
  ],
};

export { person, social, newsletter, home, about, blog, work, gallery };
