const techCoursesData = [
    { id: "java-pro", title: "Programming in Java", fee: 8460, modules: ["Introduction to Java", "OOPS Masterclass", "Multithreading", "Project Work"] },
    { id: "html5-web", title: "HTML5 Programming", fee: 9440, modules: ["Semantic HTML", "CSS3 Flexbox", "Responsive Web", "Deployment"] },
    { id: "adca-diploma", title: "Advanced Diploma in Computer Application", fee: 8500, modules: ["MS Office", "Tally Prime", "C Programming", "DBMS MySQL"] },
    { id: "python-ds", title: "Python Programming & Data Exploration in Python", fee: 9440, modules: ["Python Core", "NumPy & Pandas", "Data Visualization", "Machine Learning"] },
    { id: "tally-essential", title: "Tally Essential", fee: 15500, modules: ["Accounting Basics", "Inventory", "GST & TDS", "Financial Statements"] },
    { id: "adv-excel-pro", title: "Working with Advanced Excel", fee: 3777, modules: ["Advanced Formulas", "Pivot Tables", "Macros", "Data Analytics"] },
    { id: "full-stack-se", title: "Advanced Program in Full Stack S/E", fee: 46500, modules: ["React Frontend", "Node.js Backend", "Database Design", "Cloud DevOps"] },
    { id: "ms-office-2013", title: "Working with Microsoft Office 2013", fee: 3000, modules: ["Word", "Excel", "PowerPoint", "Outlook"] },
    { id: "tally-prime-l1", title: "Accounting with Tally Prime(Level-I)", fee: 5500, modules: ["Recording Transactions", "Banking", "Balance Sheets"] },
    { id: "prog-c", title: "Programming using C", fee: 3540, modules: ["Variables", "Control Flow", "Functions", "Arrays"] },
    { id: "prog-cpp", title: "Programming using C++", fee: 3540, modules: ["OOPS Masterclass", "Inheritance", "Polymorphism"] },
    { id: "prog-c-cpp", title: "Programming using C & C++", fee: 6450, modules: ["Foundational Logic", "Advanced OOPS"] },
    { id: "dsa", title: "Data structure & Algorithim", fee: 4842, modules: ["Stacks & Queues", "Linked Lists", "Sorting", "Trees"] },
    { id: "android-apps", title: "Developing Mobile Apps for the Android Platform", fee: 10030, modules: ["UI/UX", "Activities & Intents", "Database", "API Integration"] },
    { id: "asp-net", title: "Web Application Development using ASP.net", fee: 9440, modules: ["MVC Architecture", "Entity Framework", "Web API"] },
    { id: "dca-diploma", title: "Diploma in Computer Application", fee: 6500, modules: ["Operating Systems", "MS Office", "Internet Basics"] },
    { id: "data-analytics", title: "Professional Program in Data Analytics", fee: 22500, modules: ["SQL", "Tableau", "Power BI", "Python"] },
    { 
        id: "gen-ai-master", 
        title: "Advanced Diploma in Generative AI", 
        fee: "42500", 
        sectionId: "gen-ai-course", // Link for header sync
        modules: [
            "Foundations of LLMs & Transformers", 
            "Prompt Engineering Masterclass", 
            "Fine-tuning Custom AI Models", 
            "Building RAG Applications",
            "AI Ethics & Future Trends"
        ] 
    },
];

const universityPrograms = [
    { id: "mzu-mca", title: "MCA", university: "Mizoram University", fee: 16175, cat: "Graduates", modules: ["Sem 1-4 Complete Academic Curriculum"] },
    { id: "cu-mba", title: "MBA", university: "Chandigarh University", fee: 37500, cat: "Working Professionals", modules: ["Core Management & Industry Modules"] },
    { id: "jain-bca", title: "BCA", university: "Jain University", fee: 8583, cat: "College Students", modules: ["Sem 1-6 Complete Academic Curriculum"] }
];

module.exports = { techCoursesData, universityPrograms };