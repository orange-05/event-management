/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, FormEvent, Fragment } from "react";
import { HashRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { 
  Calendar, 
  LayoutDashboard, 
  Search, 
  Plus, 
  MapPin, 
  Ticket, 
  Users, 
  BarChart3, 
  Bell,
  Menu,
  X,
  ArrowRight,
  TrendingUp,
  Share2,
  UserCircle2,
  CheckCircle,
  Globe,
  Phone,
  Mail,
  MessageSquare,
  Activity,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatDate, formatCurrency } from "./lib/utils";
import { Event, UserProfile, UserRole } from "./types";
import { geminiService } from "./services/geminiService";
import { auth, db } from "./firebase";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { ChatWidget } from "./components/ChatWidget";
import { BookingForm } from "./components/BookingForm";
import { 
  collection,
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  runTransaction,
  Timestamp,
  getDocs
} from "firebase/firestore";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


// Mock data for initial UI
const MOCK_EVENTS: Event[] = [
  {
    id: "1",
    title: "Tech Frontiers Summit 2026",
    description: "The premier developer conference for AI and distributed systems.",
    date: "2026-06-15T09:00:00Z",
    location: "Mumbai, Maharashtra",
    price: 24900,
    totalCapacity: 500,
    remainingCapacity: 0,
    organizerId: "org1",
    status: "upcoming",
    category: "Technology",
    createdAt: new Date().toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1540575861501-7ad05823c95b?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "2",
    title: "Creative Arts Gala",
    description: "An evening of modern performance arts and immersive installations.",
    date: "2026-07-22T18:30:00Z",
    location: "New Delhi, Delhi",
    price: 12500,
    totalCapacity: 200,
    remainingCapacity: 45,
    organizerId: "org2",
    status: "upcoming",
    category: "Arts",
    createdAt: new Date().toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "3",
    title: "Future of Finance Expo",
    description: "Exploring the next generation of fintech and digital assets.",
    date: "2026-08-05T10:00:00Z",
    location: "Bangalore, Karnataka",
    price: 37500,
    totalCapacity: 1000,
    remainingCapacity: 120,
    organizerId: "org1",
    status: "upcoming",
    category: "Finance",
    createdAt: new Date().toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=800"
  }
];

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function ProtectedRoute({ user, roleRequired, children }: { user: User | null; roleRequired?: UserRole; children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roleRequired && profile?.role !== roleRequired) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingInitialType, setBookingInitialType] = useState<string | undefined>();
  
  const handleOpenBooking = (type?: string) => {
    setBookingInitialType(type);
    setIsBookingOpen(true);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  useEffect(() => {
    // Initial theme setup (default to dark for this professional look)
    document.documentElement.classList.add('dark');
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
      } else {
        const userRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
          setLoading(false);
        });
      }
    });

    const eventsQuery = query(collection(db, "events"), orderBy("date", "asc"));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(fetchedEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "events");
    });

    return () => {
      unsubscribeAuth();
      unsubscribeEvents();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-editorial-bg flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-editorial-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }
  
  // Past Events Data - Reflecting 2 years of active operations
  const pastEvents = [
    { 
      id: 'p1', 
      title: 'Grand Royal Wedding', 
      location: 'Hyderabad', 
      date: 'Feb 2025', 
      category: 'Wedding', 
      description: 'A masterpiece of Nizami opulence at Taj Falaknuma, hosting 2500+ global guests with a synchronized 7-course menu and 14th-century thematic decor.', 
      imageUrl: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800',
      attendance: '2500+ Guests'
    },
    { 
      id: 'p2', 
      title: 'Tech Innovators Summit', 
      location: 'Bangalore', 
      date: 'Aug 2025', 
      category: 'Corporate', 
      description: 'The definitive Al gathering for South Asia. Orchestrated logistical flow for 1200 Fortune 500 delegates across 4 parallel stages and 20+ interactive demo zones.', 
      imageUrl: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800',
      attendance: '1200+ Delegates'
    },
    { 
      id: 'p3', 
      title: 'Heritage Cultural Fest', 
      location: 'Chennai', 
      date: 'Nov 2024', 
      category: 'College Fest', 
      description: 'A 3-day marathon of arts and fusion music. Managed crowd flow and security for 8000+ students with state-of-the-art acoustics and digital check-in systems.', 
      imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800',
      attendance: '8000+ Attendees'
    },
    { 
      id: 'p4', 
      title: 'Fashion Week Showcase', 
      location: 'Mumbai', 
      date: 'Sept 2024', 
      category: 'Private Party', 
      description: 'An elite fashion-fusion event at the St. Regis, merging high-street aesthetics with traditional craft for 500 hand-picked VIP guests.', 
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800',
      attendance: '500+ VIPs'
    },
    { 
      id: 'p5', 
      title: 'Startup Pitch Day', 
      location: 'Pune', 
      date: 'Jan 2025', 
      category: 'Conference', 
      description: 'Fostering the next unicorn. A high-stakes environment for 200 founders to engage with 50+ VCs, featuring seamless pitch-sync tech and private breakout rooms.', 
      imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74dea327912?auto=format&fit=crop&q=80&w=800',
      attendance: '350+ Stakeholders'
    },
    { 
      id: 'p6', 
      title: 'Modern Art Vernissage', 
      location: 'Kochi', 
      date: 'Aug 2024', 
      category: 'Exhibition', 
      description: 'Transforming industrial spaces into immersive galleries. A week-long exhibition showcasing 40+ international artists for a discerning community of collectors.', 
      imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800',
      attendance: '2000+ Visitors'
    },
    { 
      id: 'p7', 
      title: 'Music Under Stars', 
      location: 'Goa', 
      date: 'Dec 2024', 
      category: 'Concert', 
      description: 'An intimate beach-front musical experience featuring indie-folk legends. Precision sound engineering and sustainable crowd management for an eco-conscious festival.', 
      imageUrl: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=800',
      attendance: '1500+ Fans'
    },
    { 
      id: 'p8', 
      title: 'Vizag Port Anniversary', 
      location: 'Vizag', 
      date: 'April 2025', 
      category: 'Corporate', 
      description: 'A logistical triumph on the coast. Orchestrated a massive corporate celebration for 5000+ employees with large-scale drone shows and harbor-side banquets.', 
      imageUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800',
      attendance: '5000+ Guests'
    },
  ];

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-text font-sans selection:bg-editorial-accent selection:text-editorial-bg transition-colors duration-500">
      <Navbar user={user} profile={profile} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      <main>
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/" element={<PageWrapper><Home events={events} pastEvents={pastEvents} /></PageWrapper>} />
            <Route path="/about" element={<PageWrapper><AboutPage /></PageWrapper>} />
            <Route path="/events" element={<PageWrapper><EventDiscovery events={events} /></PageWrapper>} />
            <Route path="/events/:id" element={<PageWrapper><EventDetails events={events} user={user} /></PageWrapper>} />
            <Route path="/login" element={<PageWrapper><Login user={user} /></PageWrapper>} />
            <Route path="/profile" element={<ProfilePageWrapper user={user} profile={profile} events={events} />} />
            <Route 
              path="/dashboard/*" 
              element={
                <ProtectedRoute user={user} roleRequired="organizer">
                  <PageWrapper><Dashboard events={events} user={user} onOpenBooking={handleOpenBooking} /></PageWrapper>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
      <ChatWidget onOpenBooking={handleOpenBooking} />
      <BookingForm 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        initialType={bookingInitialType}
      />
    </div>
  );
}

function Navbar({ user, profile, isDarkMode, toggleTheme }: { user: User | null; profile: UserProfile | null; isDarkMode: boolean; toggleTheme: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const isAdmin = profile?.role === 'organizer';
  
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine visibility: show if scrolling up or at the very top
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      
      // Determine compact mode: smaller height after initial scroll
      setIsCompact(currentScrollY > 20);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);
  
  return (
    <motion.nav 
      initial={true}
      animate={{ 
        y: isVisible ? 0 : -100,
        backgroundColor: isCompact ? 'rgba(var(--bg-rgb), 0.85)' : 'rgba(var(--bg-rgb), 0.6)',
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-editorial-border/30 backdrop-saturate-150"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div 
          animate={{ height: isCompact ? '5rem' : '6rem' }}
          className="flex justify-between items-center transition-[height] duration-500"
        >
          <div className="flex items-center gap-16 lg:gap-20">
            <Link to="/" className="flex flex-col group py-2">
              <span className="serif text-xl lg:text-2xl font-light tracking-[-0.08em] text-editorial-text italic uppercase leading-none transition-all group-hover:text-editorial-accent">
                Aahwanam
              </span>
              <span className="font-mono text-[7px] font-black tracking-[0.6em] text-editorial-accent/20 mt-1 transition-all group-hover:tracking-[0.8em] group-hover:text-editorial-accent/40 text-center">
                CORE SYSTEM
              </span>
            </Link>
            
            <div className="hidden lg:flex items-center gap-12">
              <Link to="/about" className="font-mono text-[9px] font-black text-editorial-text/30 hover:text-editorial-accent transition-all uppercase tracking-[0.5em] relative group py-2">
                HISTORY
                <span className="absolute bottom-0 left-0 w-0 h-px bg-editorial-accent/40 transition-all group-hover:w-full" />
              </Link>
              <Link to="/events" className="font-mono text-[9px] font-black text-editorial-text/30 hover:text-editorial-accent transition-all uppercase tracking-[0.5em] relative group py-2">
                DISCOVERY
                <span className="absolute bottom-0 left-0 w-0 h-px bg-editorial-accent/40 transition-all group-hover:w-full" />
              </Link>
              {user && isAdmin ? (
                <>
                  <Link to="/dashboard" className="font-mono text-[9px] font-black text-editorial-accent/60 hover:text-editorial-accent transition-all uppercase tracking-[0.5em] relative group py-2">
                    DIRECTORATE
                    <span className="absolute bottom-0 left-0 w-0 h-px bg-editorial-accent/40 transition-all group-hover:w-full" />
                  </Link>
                  <Link to="/dashboard/analytics" className="font-mono text-[9px] font-black text-editorial-accent/40 hover:text-editorial-accent transition-all uppercase tracking-[0.5em] relative group py-2">
                    INTELLIGENCE
                    <span className="absolute bottom-0 left-0 w-0 h-px bg-editorial-accent/40 transition-all group-hover:w-full" />
                  </Link>
                </>
              ) : user && (
                <Link to="/profile" className="font-mono text-[9px] font-black text-editorial-accent/50 hover:text-editorial-accent transition-all uppercase tracking-[0.5em] relative group py-2">
                  REGISTRY
                  <span className="absolute bottom-0 left-0 w-0 h-px bg-editorial-accent/40 transition-all group-hover:w-full" />
                </Link>
              )}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center border border-editorial-border/30 hover:border-editorial-accent/40 transition-all text-editorial-accent/40 hover:text-editorial-accent cursor-pointer rounded-none group relative overflow-hidden"
              title={isDarkMode ? "LUMINANCE" : "OBSCURITY"}
            >
              <div className="absolute inset-0 bg-editorial-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              {isDarkMode ? (
                <Sun size={13} className="relative z-10 group-hover:rotate-180 transition-transform duration-700" />
              ) : (
                <Moon size={13} className="relative z-10 group-hover:-rotate-45 transition-transform duration-700" />
              )}
            </button>
            
            {user ? (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 group cursor-pointer border-x border-editorial-border/20 px-6 py-2">
                  <div className="relative">
                    <div className="w-8 h-8 border border-editorial-border/40 p-0.5 group-hover:border-editorial-accent/60 transition-all">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName || ''} 
                          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="w-full h-full bg-editorial-text/5 flex items-center justify-center">
                          <UserCircle2 size={14} className="text-editorial-text/20" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-mono text-[7px] font-black uppercase tracking-[0.2em] text-editorial-text/20 group-hover:text-editorial-accent/40 transition-colors">
                      {user.displayName?.split(' ')[0].toUpperCase() || 'GUEST'}
                    </span>
                    <span className="font-mono text-[7px] text-editorial-accent/30 uppercase tracking-[0.4em] italic leading-none mt-1">
                      {isAdmin ? 'DIRECTOR' : 'PATRON'}
                    </span>
                  </div>
                </div>
                
                {isAdmin && (
                  <Link to="/dashboard/create" className="h-9 px-6 flex items-center bg-editorial-accent text-editorial-bg font-mono text-[8.5px] font-black uppercase tracking-[0.4em] hover:bg-editorial-text transition-all duration-500 relative group overflow-hidden">
                    <span className="relative z-10">CREATE</span>
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                  </Link>
                )}
                <button 
                  onClick={handleLogout}
                  className="font-mono text-[8px] font-black text-editorial-text/20 hover:text-red-500/60 transition-colors uppercase tracking-[0.4em] cursor-pointer"
                >
                  SIGNOUT
                </button>
              </div>
            ) : (
              <Link to="/login" className="font-mono text-[9px] font-bold bg-editorial-text text-editorial-bg px-8 py-3.5 hover:bg-editorial-accent transition-all uppercase tracking-[0.4em] relative overflow-hidden group">
                <span className="relative z-10">PORTAL AUTH</span>
                <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              </Link>
            )}
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 border border-editorial-border text-editorial-accent"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-editorial-text/60">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-nav border-b border-editorial-border overflow-hidden"
          >
            <div className="px-8 py-16 flex flex-col gap-10 bg-editorial-bg">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-8 h-px bg-editorial-accent/30" />
                <p className="font-mono text-[8px] font-black tracking-[0.5em] text-editorial-accent italic uppercase text-center w-full">System Entry</p>
              </div>
              <Link to="/about" onClick={() => setIsOpen(false)} className="font-mono text-[11px] font-black uppercase tracking-[0.6em] text-editorial-text/40 hover:text-editorial-accent transition-colors italic border-l border-editorial-border/30 pl-4">History</Link>
              <Link to="/events" onClick={() => setIsOpen(false)} className="font-mono text-[11px] font-black uppercase tracking-[0.6em] text-editorial-text/40 hover:text-editorial-accent transition-colors italic border-l border-editorial-border/30 pl-4">Discovery</Link>
              {user && isAdmin && (
                <Link to="/dashboard" onClick={() => setIsOpen(false)} className="font-mono text-[11px] font-black uppercase tracking-[0.6em] text-editorial-accent/60 hover:text-editorial-accent transition-colors italic border-l border-editorial-accent/30 pl-4">Directorate</Link>
              )}
              {user && !isAdmin && (
                <Link to="/profile" onClick={() => setIsOpen(false)} className="font-mono text-[11px] font-black uppercase tracking-[0.6em] text-editorial-text/40 hover:text-editorial-accent transition-colors italic border-l border-editorial-border/30 pl-4">Registry</Link>
              )}
              <div className="pt-12 border-t border-editorial-border/20">
                <Link 
                  to={isAdmin ? "/dashboard/create" : "/events"} 
                  onClick={() => setIsOpen(false)} 
                  className="bg-editorial-accent text-editorial-bg px-8 py-6 font-mono text-[10px] font-black uppercase tracking-[0.5em] text-center block w-full relative overflow-hidden group"
                >
                  <span className="relative z-10">{isAdmin ? "CREATE EVENT" : "BROWSE EVENTS"}</span>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function AboutPage() {
  return (
    <div className="pt-40 pb-20 px-4 max-w-7xl mx-auto space-y-32">
      <section className="grid lg:grid-cols-2 gap-20 items-center">
        <motion.div
           initial={{ opacity: 0, x: -30 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.8 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-editorial-accent mb-8">Executive Vision</p>
          <h1 className="serif text-7xl lg:text-9xl italic tracking-tighter text-editorial-text mb-12">The 2 Year <br /><span className="text-editorial-text/20">Sojourn.</span></h1>
          <div className="space-y-8 text-lg font-light text-editorial-text/70 italic leading-relaxed max-w-xl border-l-2 border-editorial-accent pl-8">
            <p>
              "When I conceptualized Aahwanam in early 2024, the goal wasn't just to manage logistics; it was to architect memories that withstand the test of time. Over the last 24 months, we have transitioned from a local boutique service to a pan-India operation, trusted by the most discerning patrons."
            </p>
            <p>
              "Our journey has been defined by a relentless pursuit of aesthetic perfection and operational integrity. From our first intimate gathering in Hyderabad to orchestrating massive industrial milestones in Vizag, every event has been a chapter in our growing legacy of client trust."
            </p>
            <div className="pt-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-editorial-accent">— Ashish Janapareddi, Founder & MD</p>
            </div>
          </div>
        </motion.div>
        <div className="relative aspect-square lg:aspect-auto lg:h-[70vh] border border-editorial-border overflow-hidden grayscale hover:grayscale-0 transition-all duration-1000 group">
          <img 
            src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=1200" 
            alt="Founder Signature Workspace" 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-editorial-bg via-transparent to-transparent opacity-60" />
        </div>
      </section>

      <section className="py-20 border-t border-editorial-border">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { year: '2024', event: 'Genesis', desc: 'Aahwanam launched with a vision for premium curation, completing 20+ boutique weddings in its first 6 months.' },
            { year: '2025', event: 'Expansion', desc: 'Established operational vectors in 3 major cities: Hyderabad, Bangalore, and Chennai. Team scaled to 40+ professionals.' },
            { year: '2026', event: 'Scale', desc: 'Surpassed the 100-event milestone, establishing a nationwide reputation for high-stakes corporate and social logistics.' }
          ].map((item, i) => (
            <div key={i} className="space-y-6">
              <span className="serif text-6xl italic text-editorial-accent/20">{item.year}</span>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-editorial-text">{item.event}</h3>
              <p className="text-xs text-editorial-text/40 leading-loose italic">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-editorial-text/[0.02] p-20 border border-editorial-border">
         <div className="max-w-2xl">
           <h2 className="serif text-5xl italic text-editorial-text mb-12">Strategic Alliances.</h2>
           <p className="text-sm font-light text-editorial-text/60 leading-relaxed mb-12 italic">
              Our capability to deliver excellence is bolstered by a rigorous network of over 50+, ISO-certified vendors and strategic partnerships with Indias leading luxury hotel chains.
           </p>
           <div className="flex flex-wrap gap-12 opacity-30 grayscale group">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair">Taj Group</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair">Oberoi Luxe</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair">Marriott Int.</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair">ITC Hotels</span>
           </div>
         </div>
      </section>
    </div>
  );
}

interface SparkPoint {
  name: string;
  value: number;
}

interface ActivityLog {
  type: 'SUCCESS' | 'INFO' | 'WARNING';
  msg: string;
  date: string;
  city: string;
}

interface ClientSnapshot {
  name: string;
  events: number;
  value: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  role: string;
  assignedTo: string;
  priority: string;
  createdAt?: any;
}

interface Collaborator {
  id: string;
  name: string;
  role: string;
  joinedAt: any;
}

interface PerformanceMetric {
  name: string;
  value: number;
  color: string;
}

interface PieSector {
  name: string;
  value: number;
  color: string;
}

function CountUp({ end, duration = 2, prefix = "", suffix = "" }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!ref || hasAnimated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          let start = 0;
          const increment = end / (duration * 60);
          const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 1000 / 60);
          return () => clearInterval(timer);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, end, duration, hasAnimated]);

  const formattedCount = end >= 1000 ? count.toLocaleString() : count;

  return <span ref={setRef}>{prefix}{formattedCount}{suffix}</span>;
}

function Home({ events, pastEvents = [] }: { events: Event[]; pastEvents?: any[] }) {
  return (
    <div className="relative">
      {/* Dynamic Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-editorial-accent/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] left-[50%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Hero & Founder Section */}
      <section className="min-h-screen flex flex-col items-center justify-center pt-32 pb-40 px-4 relative z-10">
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-accent mb-12 flex items-center gap-4">
              <span className="w-12 h-px bg-editorial-accent/30" />
              ARCHITECT OF ATMOSPHERE
            </p>
            <h1 className="serif text-8xl lg:text-[11rem] font-light tracking-tighter italic leading-[0.75] mb-16">
              Vision <br /><span className="text-editorial-text/5 italic">Director.</span>
            </h1>
            <div className="max-w-lg space-y-10 relative">
              <div className="absolute -left-16 -top-12 text-9xl serif text-editorial-accent/5 pointer-events-none select-none">“</div>
              <p className="text-2xl text-editorial-text/60 leading-snug italic border-l-[1px] border-editorial-accent/20 pl-12 pb-2 font-light">
                "Events are not just dates in a calendar; they are the architectural blueprints of human connection. We curate movements that resonate with the core soul of our culture."
              </p>
              <div className="flex gap-6 items-center">
                <div className="w-16 h-px bg-editorial-accent/20" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-accent/60 italic">ASHISH JANAPAREDDI — MANAGING DIRECTOR</span>
              </div>
            </div>
            <div className="mt-20 flex flex-wrap gap-10">
              <Link to="/events" className="bg-editorial-accent text-editorial-bg px-14 py-6 text-[10px] font-bold uppercase tracking-[0.5em] hover:bg-editorial-text hover:text-editorial-bg transition-all shadow-2xl relative group overflow-hidden">
                <span className="relative z-10">CORE REGISTRY</span>
                <div className="absolute inset-0 bg-editorial-text translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              </Link>
              <Link to="/about" className="border border-editorial-border text-editorial-text/40 hover:text-editorial-accent hover:border-editorial-accent/40 px-14 py-6 text-[10px] font-bold uppercase tracking-[0.5em] transition-all relative group">
                THE JOURNEY
                <div className="absolute -bottom-2 left-0 w-0 h-px bg-editorial-accent/30 group-hover:w-full transition-all" />
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2 }}
            className="relative group lg:h-[85vh] w-full"
          >
            <div className="absolute -inset-10 bg-editorial-accent/5 blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-1000" />
            <div className="relative h-full border border-editorial-border overflow-hidden shadow-2xl bg-editorial-card group-hover:border-editorial-accent/20 transition-colors duration-1000">
              <div className="absolute top-8 left-8 z-20">
                 <div className="font-mono text-[8px] font-medium tracking-[0.4em] text-editorial-accent/40 uppercase mb-2">SIGNAL ANALYSIS</div>
                 <div className="w-16 h-px bg-editorial-accent/20" />
              </div>
              <img 
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=1200" 
                alt="Founder Signature" 
                className="w-full h-full object-cover grayscale opacity-[0.85] group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 scale-[1.01] group-hover:scale-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-editorial-bg/80 via-transparent to-transparent" />
              <div className="absolute bottom-16 left-16 z-20">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '120px' }}
                  transition={{ delay: 0.5, duration: 1 }}
                  className="h-[1px] bg-editorial-accent mb-8"
                />
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.6em] text-editorial-accent mb-4 opacity-60">EXECUTIVE SIGNATURE</p>
                <h2 className="serif text-6xl text-editorial-text italic tracking-tighter leading-none mb-2">Ashish Janapareddi</h2>
                <p className="font-mono text-[7px] text-editorial-text/20 uppercase tracking-[0.5em] italic">VERIFIED DIRECTORATE</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Statistics Section - Animated Counters */}
      <section className="py-24 border-y border-editorial-border relative z-10 bg-editorial-bg overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-20">
          {[
            { val: 120, label: 'COMPLETED EVENTS', suffix: '+' },
            { val: 85, label: 'CLIENT PORTFOLIOS', suffix: '+' },
            { val: 12, label: 'GEOGRAPHIC NODES', suffix: '+' },
            { val: 2, label: 'OPERATIONAL YEARS', suffix: '' }
          ].map((stat, i) => (
            <div key={i} className="text-left group relative pl-8 border-l border-editorial-border hover:border-editorial-accent/30 transition-colors">
               <div className="absolute top-0 -left-1 w-2 h-2 bg-editorial-accent/20 rounded-full group-hover:bg-editorial-accent transition-all" />
               <h4 className="serif text-7xl lg:text-8xl italic text-editorial-text group-hover:text-editorial-accent transition-colors mb-6 leading-none">
                 <CountUp end={stat.val} />{stat.suffix}
               </h4>
               <p className="font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-text/20 group-hover:text-editorial-accent/60 transition-colors italic">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portfolio / Highlights Section */}
      <section className="py-48 bg-editorial-card/30 relative z-10 border-b border-editorial-border overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[45rem] font-black serif text-editorial-text uppercase rotate-6 scale-150">
             MUSE.LOG
           </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 relative z-10">
          <div className="mb-32 text-center max-w-4xl mx-auto">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.8em] text-editorial-accent mb-10 italic">CURATION MILESTONES</p>
            <h2 className="serif text-8xl lg:text-[9.5rem] font-light italic text-editorial-text tracking-tighter leading-[0.85] mb-12">High-Stakes <br /><span className="text-editorial-accent/10 italic">Environments.</span></h2>
            <div className="h-px w-32 bg-editorial-accent/30 mx-auto" />
          </div>
          <div className="grid lg:grid-cols-3 gap-12">
            {[
              { label: 'INTEGRITY PRIME', title: 'Impeccable execution is our baseline signature.', icon: <CheckCircle className="text-editorial-accent/60" size={28} strokeWidth={1} />, bg: 'bg-editorial-text/[0.01]' },
              { label: 'AMBITION VECTOR', title: 'Redefining the scale of experiential design.', icon: <TrendingUp className="text-editorial-accent" size={28} strokeWidth={1} />, bg: 'bg-editorial-accent/[0.02]' },
              { label: 'GLOBAL SYNC', title: 'Seamless logistical orchestration across borders.', icon: <Globe className="text-editorial-text/40" size={28} strokeWidth={1} />, bg: 'bg-editorial-text/[0.01]' }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.8 }}
                className={cn(
                  "stat-card p-16 border-editorial-border/40 hover:border-editorial-accent/40 transition-all group backdrop-blur-2xl relative overflow-hidden",
                  item.bg
                )}
              >
                <div className="mb-14 h-12 flex items-center">
                  <div className="p-4 border border-editorial-border/30 group-hover:border-editorial-accent/30 transition-colors bg-editorial-bg/50">
                    {item.icon}
                  </div>
                </div>
                <h4 className="font-mono text-[9px] font-black uppercase tracking-[0.6em] text-editorial-text/20 mb-8 border-b border-editorial-border/20 pb-4 inline-block group-hover:text-editorial-accent/40 transition-colors">{item.label}</h4>
                <p className="serif text-4xl text-editorial-text/80 italic leading-snug group-hover:text-editorial-accent transition-all duration-700">{item.title}</p>
                <div className="absolute top-8 right-8 font-mono text-[10px] text-editorial-text/5 font-black uppercase tracking-widest italic group-hover:text-editorial-accent/5 transition-colors">
                  NODE_{i+1}
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-editorial-accent/20 w-0 group-hover:w-full transition-all duration-1000" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Scheduled Events */}
      <section className="py-40 px-4 max-w-7xl mx-auto relative z-10">
        <div className="mb-24 flex flex-col lg:flex-row justify-between items-baseline gap-12 border-b border-editorial-border pb-16">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-editorial-accent mb-6 italic">Active Catalogue</p>
            <h2 className="serif text-8xl lg:text-[10rem] font-light tracking-tighter italic text-editorial-text leading-none">The <br /><span className="text-editorial-accent/20">Protocols.</span></h2>
          </div>
          <Link 
            to="/events" 
            className="group flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.5em] text-editorial-accent hover:text-editorial-bg transition-all italic border border-editorial-accent/20 px-12 py-6 bg-editorial-accent/5 hover:bg-editorial-accent hover:scale-105"
          >
            Full Registry <ArrowRight className="group-hover:translate-x-4 transition-transform" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-16">
          {events.slice(0, 3).map((event, idx) => (
            <div key={event.id}>
              <EventCard event={event} index={idx} />
            </div>
          ))}
        </div>
      </section>

      {/* Gallery of Past Events */}
      <section id="past-events" className="py-40 bg-editorial-card/30 relative z-10 overflow-hidden border-t border-editorial-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-24 text-center lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-accent mb-6 italic">History in Motion</p>
            <h2 className="serif text-7xl lg:text-9xl font-light italic text-editorial-text tracking-tighter leading-none">Legacy <br /><span className="text-editorial-text/20">Reflections.</span></h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {pastEvents.map((event, idx) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.8 }}
                className="group relative"
              >
                <div 
                  className="block cursor-default"
                >
                  <div className="aspect-[3/4] bg-editorial-card overflow-hidden border border-editorial-border mb-8 grayscale group-hover:grayscale-0 transition-all duration-1000 shadow-2xl relative">
                    <div className="absolute inset-0 bg-editorial-accent opacity-0 group-hover:opacity-10 transition-opacity z-10" />
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000" />
                    <div className="absolute inset-0 border-[20px] border-editorial-text/0 group-hover:border-editorial-text/5 transition-all duration-700 pointer-events-none z-20" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-700 z-30">
                      <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-accent mb-4">{event.category}</p>
                      <p className="text-[11px] text-editorial-text/70 italic leading-relaxed font-light">{event.description}</p>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-[9px] font-bold text-editorial-accent/60 uppercase tracking-widest italic">{event.attendance}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-2 space-y-2">
                  <h3 className="serif text-2xl italic text-editorial-text group-hover:text-editorial-accent transition-colors leading-none">{event.title}</h3>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/30 border-t border-editorial-border pt-4">
                    <span className="flex items-center gap-2">
                       <MapPin size={10} className="text-editorial-accent" />
                       {event.location}
                    </span>
                    <span className="text-editorial-accent/60">{event.date}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-40 relative z-10 border-t border-editorial-border px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-accent mb-8 italic">Patron Testimonials</p>
              <h2 className="serif text-7xl lg:text-[8rem] font-light italic text-editorial-text tracking-tighter leading-none mb-12">The <br /><span className="text-editorial-text/20">Consensus.</span></h2>
              <div className="p-12 border border-blue-500/10 bg-blue-500/[0.02]">
                <p className="text-[11px] text-editorial-text/40 leading-loose italic uppercase tracking-widest">
                  Authentication of service quality through the verified experiences of our most discerning collaborators and clients.
                </p>
              </div>
            </div>
            <div className="space-y-8">
              {[
                { name: 'Priya & Rahul', role: 'Wedding Patrols', text: 'Aahwanam transformed our wedding into a literal masterpiece. Their attention to detail in the Falaknuma gala was unrivaled.' },
                { name: 'Karan Mehta', role: 'CEO TechGen', text: 'Professionalism at its peak. Our corporate summit was flawless thanks to Ashish and his team. The technical flow was surgical.' },
                { name: 'Dr. Anjali Rao', role: 'Art Collector', text: 'The most seamless execution I’ve seen in the art world. They understand the nuance of atmosphere like no other.' }
              ].map((test, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-10 border border-editorial-border bg-editorial-text/[0.01] hover:bg-editorial-text/[0.03] transition-colors group"
                >
                  <p className="text-xl italic text-editorial-text/80 mb-8 font-light italic leading-relaxed">"{test.text}"</p>
                  <div className="flex justify-between items-center">
                     <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-accent">{test.name}</p>
                     <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-editorial-text/20">{test.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blog / Updates Section */}
      <section className="py-40 bg-editorial-text/[0.03] relative z-10 border-t border-editorial-border px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-accent mb-6 italic">Intel Reports</p>
              <h2 className="serif text-8xl lg:text-9xl font-light italic text-editorial-text tracking-tighter leading-none">Journal <br /><span className="text-editorial-text/20">Briefings.</span></h2>
            </div>
            <p className="hidden lg:block text-[10px] font-bold text-editorial-text/30 uppercase tracking-widest italic max-w-xs text-right">
               Bi-weekly insights into the architecture of luxury events and the future of human gathering.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {[
              { title: 'Top Wedding Trends 2025', date: 'May 2026', category: 'LuxeTrends', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800' },
              { title: 'Designing High-Stakes Summits', date: 'April 2026', category: 'Strategic Intel', image: 'https://images.unsplash.com/photo-1475721027785-f74dea327912?auto=format&fit=crop&q=80&w=800' },
              { title: 'Behind the Scenes: Vizag Port 5000', date: 'March 2026', category: 'Case Study', image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800' }
            ].map((blog, i) => (
              <motion.div key={i} className="group cursor-pointer">
                <div className="aspect-video overflow-hidden border border-editorial-border mb-8 grayscale group-hover:grayscale-0 transition-all duration-700 relative">
                  <img src={blog.image} alt={blog.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                  <div className="absolute top-4 left-4 bg-editorial-bg/80 backdrop-blur-md px-4 py-2 border border-editorial-border">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-editorial-accent">{blog.category}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="serif text-3xl italic text-editorial-text group-hover:text-editorial-accent transition-colors">{blog.title}</h3>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-editorial-text/30">
                    <span>{blog.date}</span>
                    <span className="group-hover:translate-x-4 transition-transform text-editorial-accent">Read Dispatch →</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-40 px-4 relative z-10 bg-editorial-bg border-t border-editorial-border overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-editorial-accent/5 blur-[200px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-32 items-center relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-accent mb-10 italic">Communication Protocol</p>
            <h2 className="serif text-8xl lg:text-[11rem] font-light italic text-editorial-text tracking-tighter leading-none mb-16">Connect <br /><span className="text-editorial-accent/20">The Signal.</span></h2>
            <div className="space-y-12 max-w-sm">
              <p className="text-editorial-text/60 text-lg leading-relaxed italic font-light border-l border-editorial-border pl-8">
                Whether you are initiating a new collection or seeking guidance on established protocols, our communication channels remain open for secure data exchange.
              </p>
              <div className="flex flex-col gap-6">
                <a href="tel:+917981648202" className="flex items-center justify-between group border-b border-editorial-border py-6 text-[12px] font-bold uppercase tracking-[0.4em] text-editorial-text/50 hover:text-editorial-accent transition-all">
                  <span className="italic uppercase">Telephonic Link</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">+91 79816 48202</span>
                    <Phone size={16} className="group-hover:rotate-12 transition-transform" />
                  </div>
                </a>
                <a href="mailto:ashishjanapareddi@gmail.com" className="flex items-center justify-between group border-b border-editorial-border py-6 text-[12px] font-bold uppercase tracking-[0.4em] text-editorial-text/50 hover:text-editorial-accent transition-all">
                  <span className="italic uppercase">Data Packet (Email)</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">ashishjanapareddi@gmail.com</span>
                    <Mail size={16} className="group-hover:translate-y-[-2px] transition-transform" />
                  </div>
                </a>
                <a href="https://wa.me/917981648202" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group border-b border-editorial-border py-6 text-[12px] font-bold uppercase tracking-[0.4em] text-editorial-text/50 hover:text-editorial-accent transition-all">
                  <span className="italic uppercase">Instant Message</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">WhatsApp Secure</span>
                    <MessageSquare size={16} className="group-hover:scale-110 transition-transform" />
                  </div>
                </a>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <motion.a 
              whileHover={{ y: -10 }}
              href="tel:+917981648202"
              className="stat-card p-14 border border-editorial-border bg-blue-600/10 hover:bg-blue-600/20 flex flex-col items-center justify-center text-center group transition-all shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-5 transition-opacity" />
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-8 text-blue-400 group-hover:bg-blue-400 group-hover:text-editorial-bg transition-all">
                <Phone size={24} />
              </div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-editorial-text mb-3 italic tracking-widest">Call Now</h4>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.2em] italic">+91 79816 48202</p>
            </motion.a>

            <motion.a 
              whileHover={{ y: -10 }}
              href="https://wa.me/917981648202"
              target="_blank"
              rel="noopener noreferrer"
              className="stat-card p-14 border border-editorial-border bg-green-600/10 hover:bg-green-600/20 flex flex-col items-center justify-center text-center group transition-all shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-green-500 opacity-0 group-hover:opacity-5 transition-opacity" />
              <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mb-8 text-green-400 group-hover:bg-green-400 group-hover:text-editorial-bg transition-all">
                <MessageSquare size={24} />
              </div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-editorial-text mb-3 italic tracking-widest">WhatsApp</h4>
              <p className="text-[9px] font-bold text-green-400 uppercase tracking-[0.2em] italic">Open Chat Protocol</p>
            </motion.a>

            <motion.a 
              whileHover={{ y: -10 }}
              href="mailto:ashishjanapareddi@gmail.com"
              className="stat-card p-16 border border-editorial-border bg-purple-600/10 hover:bg-purple-600/20 flex flex-col items-center justify-center text-center group transition-all sm:col-span-2 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-purple-500 opacity-0 group-hover:opacity-5 transition-opacity" />
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-8 text-purple-400 group-hover:bg-purple-400 group-hover:text-editorial-bg transition-all">
                <Mail size={24} />
              </div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-editorial-text mb-4 italic tracking-widest">Inquiry Dispatch</h4>
              <p className="text-[12px] font-bold text-purple-400 tracking-[0.5em] italic group-hover:text-editorial-text transition-colors uppercase">ASHISHJANAPAREDDI@GMAIL.COM</p>
            </motion.a>
          </div>
        </div>
      </section>

      {/* Legacy Link Repository */}
      <section className="py-32 border-t border-editorial-border relative z-10 text-center bg-editorial-text/[0.03]">
         <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-text/30 mb-10 italic">Legacy Archive Access</p>
         <a 
           href="https://orange-05.github.io/event-management/events" 
           target="_blank" 
           rel="noopener noreferrer"
           className="inline-flex items-center gap-10 group text-editorial-text/50 hover:text-editorial-accent transition-all p-8 border border-editorial-border hover:border-editorial-accent/30 bg-editorial-bg"
         >
            <span className="text-[12px] font-bold uppercase tracking-[0.5em] italic border-b border-editorial-accent/40 pb-3">V.01 Registry Protocol</span>
            <div className="w-12 h-12 rounded-full border border-editorial-accent/20 flex items-center justify-center group-hover:bg-editorial-accent group-hover:text-editorial-bg transition-all">
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
         </a>
      </section>
    </div>
  );
}

function EventCard({ event, index }: { event: Event; index: number; key?: string }) {
  const isSoldOut = event.remainingCapacity === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.8 }}
      className="group relative"
    >
      <Link to={`/events/${event.id}`} className="block">
        <div className="aspect-[4/5] bg-editorial-card border border-editorial-border overflow-hidden relative group-hover:border-editorial-accent/30 transition-all duration-700 shadow-soft">
          <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
            <span className="font-mono text-[8px] font-black uppercase tracking-[0.4em] px-3 py-1 bg-editorial-bg/80 backdrop-blur-md border border-editorial-border text-editorial-accent/80">SIGNAL_ID.0X{event.id.padStart(2, '0')}</span>
            {isSoldOut && <span className="font-mono text-[8px] font-black uppercase tracking-[0.4em] px-3 py-1 bg-red-500/10 backdrop-blur-md border border-red-500/20 text-red-500">MANDATE_CLOSED</span>}
          </div>
          
          <img 
            src={event.imageUrl} 
            alt={event.title} 
            className={cn(
              "w-full h-full object-cover transition-all duration-1000 grayscale group-hover:grayscale-0 scale-[1.01] group-hover:scale-105",
              isSoldOut ? "opacity-30" : "opacity-[0.85] group-hover:opacity-100"
            )} 
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-editorial-bg/95 via-transparent to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-700" />
          
          <div className="absolute bottom-0 left-0 right-0 p-8 z-20 translate-y-4 group-hover:translate-y-0 transition-transform duration-700">
             <div className="flex items-center gap-3 mb-6 opacity-40">
                <div className="h-px w-8 bg-editorial-accent" />
                <span className="font-mono text-[7px] font-bold uppercase tracking-[0.5em] text-editorial-accent">{event.category}</span>
             </div>
             <h3 className="serif text-3xl lg:text-4xl text-editorial-text italic leading-tight tracking-tighter uppercase mb-8 group-hover:text-editorial-accent transition-colors">
               {event.title}
             </h3>
             <div className="flex justify-between items-center pt-6 border-t border-editorial-border/30">
                <div className="flex flex-col">
                  <span className="font-mono text-[8px] text-editorial-text/20 uppercase tracking-widest mb-1">DATE_LOCK</span>
                  <span className="serif text-xl text-editorial-accent italic">{formatDate(event.date)}</span>
                </div>
                <div className="text-right flex flex-col">
                  <span className="font-mono text-[8px] text-editorial-text/20 uppercase tracking-widest mb-1">REG_FEE</span>
                  <span className="font-mono text-[11px] font-bold text-editorial-text/60 tracking-widest">{formatCurrency(event.price)}</span>
                </div>
             </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="px-4 sm:px-6 lg:px-8 py-32 border-t border-editorial-border bg-editorial-bg relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-20 items-start mb-32">
          <div className="md:col-span-4">
            <div className="serif text-5xl font-bold tracking-tighter text-editorial-accent italic mb-10 uppercase">AAHWANAM</div>
            <p className="text-editorial-text/40 leading-loose font-medium text-[11px] italic uppercase tracking-[0.2em] max-w-sm">
              Curating high-performance human experiences and cultural milestones with uncompromising aesthetic precision.
            </p>
          </div>
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-16">
            <FooterCol title="Discovery" links={["Past Collections", "Upcoming Summits", "Patron Registry", "Vision Studio"]} />
            <FooterCol title="Studio" links={["Collaboration", "Curator Portal", "Analytics", "Check-in Protocol"]} />
            <FooterCol title="Connect" links={["Twitter", "Instagram", "LinkedIn"]} />
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-12 pt-16 border-t border-editorial-border">
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-editorial-text/20">
            © 2024–2026 Aahwanam. All rights reserved.
          </div>
          <div className="flex gap-12 text-[10px] uppercase tracking-[0.4em] font-bold text-editorial-text/30">
            <a href="#" className="hover:text-editorial-accent transition-colors italic">Mumbai</a>
            <a href="#" className="hover:text-editorial-accent transition-colors italic">New Delhi</a>
            <a href="#" className="hover:text-editorial-accent transition-colors italic">Bangalore</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="flex flex-col gap-6">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/30">{title}</h4>
      <ul className="flex flex-col gap-4">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="text-[10px] font-bold uppercase tracking-[0.3em] hover:text-editorial-accent transition-colors italic whitespace-nowrap text-editorial-text/60">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Login({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'user' | 'admin'>('user');
  const [adminCode, setAdminCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const ADMIN_ACCESS_CODE = "aahawanam_admin"; // This would typically be verified server-side

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    if (mode === 'admin') {
      setError("Google Sign-In is only for Users. Admins must use secure credentials.");
      return;
    }
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'attendee',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      navigate('/events');
    } catch (err: any) {
      console.error("Google Auth error:", err);
      let msg = "Failed to sign in with Google.";
      if (err.code === 'auth/operation-not-allowed') {
        msg = "Google Sign-In is disabled. Please enable it in your Firebase Console (Authentication > Sign-in method).";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both identity token and security signature.");
      return;
    }

    setError(null);
    if (mode === 'admin' && adminCode !== ADMIN_ACCESS_CODE) {
      setError("Invalid Administrative Access Code.");
      return;
    }

    setLoading(true);
    try {
      let userCredential;
      try {
        // Attempt sign in
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (signInErr: any) {
        // If user doesn't exist, create them (Access Portal behavior)
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
          } catch (createErr: any) {
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }

      const user = userCredential.user;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const targetRole: UserRole = mode === 'admin' ? 'organizer' : 'attendee';

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: email.split('@')[0],
          photoURL: null,
          role: targetRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Update role if they provide a valid admin code but were previously an attendee
        if (mode === 'admin') {
          await setDoc(userRef, { role: 'organizer', updatedAt: serverTimestamp() }, { merge: true });
        }
      }

      navigate(targetRole === 'organizer' ? '/dashboard' : '/events');
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = "Authentication failed.";
      if (err.code === 'auth/wrong-password') msg = "Invalid security signature.";
      if (err.code === 'auth/invalid-email') msg = "Invalid identity format.";
      if (err.code === 'auth/weak-password') msg = "Security signature too weak (min 6 characters).";
      if (err.code === 'auth/email-already-in-use') msg = "This identity is already registered. Please check your security signature.";
      if (err.code === 'auth/operation-not-allowed') {
        msg = "Email/Password sign-in is disabled. Please enable it in your Firebase Console (Authentication > Sign-in method).";
      }
      if (err.code === 'auth/too-many-requests') msg = "Access blocked due to multiple failed attempts. Please reset your identity or try again later.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-24 px-4 bg-editorial-bg relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-editorial-accent/20" />
      <div className="absolute top-0 right-0 p-10 opacity-5">
         <div className="font-mono text-[8px] font-black uppercase tracking-[1em]">LOGIN GATE</div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "circOut" }}
        className="stat-card border border-editorial-border p-12 sm:p-24 w-full max-w-2xl shadow-2xl relative overflow-hidden bg-editorial-card/40 backdrop-blur-3xl"
      >
        <div className="absolute top-0 left-0 w-1 h-32 bg-editorial-accent/40" />
        <div className="absolute top-0 right-0 p-6 opacity-5 flex gap-2">
           <div className="w-1.5 h-1.5 bg-editorial-accent rounded-none" />
           <div className="w-1.5 h-1.5 bg-editorial-accent rounded-none opacity-50" />
        </div>

        <div className="flex border-b border-editorial-border mb-16 px-4">
          <button 
            onClick={() => { setMode('user'); setError(null); }}
            className={cn(
              "flex-1 py-8 font-mono text-[10px] font-black uppercase tracking-[0.6em] transition-all cursor-pointer relative group",
              mode === 'user' ? "text-editorial-accent" : "text-editorial-text/20 hover:text-editorial-text/40"
            )}
          >
            USER PORTAL
            {mode === 'user' && <div className="absolute bottom-0 left-0 w-full h-px bg-editorial-accent animate-pulse" />}
          </button>
          <button 
            onClick={() => { setMode('admin'); setError(null); }}
            className={cn(
              "flex-1 py-8 font-mono text-[10px] font-black uppercase tracking-[0.6em] transition-all cursor-pointer relative group",
              mode === 'admin' ? "text-editorial-accent" : "text-editorial-text/20 hover:text-editorial-text/40"
            )}
          >
            ADMIN PROTOCOL
            {mode === 'admin' && <div className="absolute bottom-0 left-0 w-full h-px bg-editorial-accent animate-pulse" />}
          </button>
        </div>

        <div className="relative z-10 px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent mb-8 italic flex items-center gap-3">
            <span className="w-8 h-px bg-editorial-accent/30" />
            {mode === 'user' ? "REGISTRY ACCESS" : "COMMAND CENTER"}
          </p>
          <h1 className="serif text-5xl sm:text-7xl font-light tracking-tighter italic text-editorial-text mb-12">
            Authentication <br /><span className="text-editorial-text/5 italic">{mode === 'user' ? "Required." : "Sequence."}</span>
          </h1>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-[0.2em] p-6 mb-12">
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialSignIn} className="space-y-10 mb-16">
            {mode === 'admin' && (
              <div className="text-left group">
                <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 block mb-4 ml-1 italic transition-colors group-focus-within:text-editorial-accent">ADMIN ACCESS KEY</label>
                <input 
                  type="text" 
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  placeholder="KEY-XXXXXXXX" 
                  className="w-full bg-editorial-text/[0.01] border border-editorial-border px-8 py-6 font-mono text-[10px] font-black uppercase tracking-[0.4em] focus:border-editorial-accent focus:outline-none transition-all placeholder:text-editorial-text/5 text-editorial-text shadow-inner" 
                />
              </div>
            )}
            
            <div className="text-left group">
              <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 block mb-4 ml-1 italic transition-colors group-focus-within:text-editorial-accent">EMAIL ADDRESS</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="USER@AAHWANAM.COM" 
                className="w-full bg-editorial-text/[0.01] border border-editorial-border px-8 py-6 font-mono text-[10px] font-black uppercase tracking-[0.4em] focus:border-editorial-accent focus:outline-none transition-all placeholder:text-editorial-text/5 text-editorial-text shadow-inner" 
              />
            </div>
            
            <div className="text-left group">
              <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 block mb-4 ml-1 italic transition-colors group-focus-within:text-editorial-accent">PASSWORD</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••" 
                className="w-full bg-editorial-text/[0.01] border border-editorial-border px-8 py-6 font-mono text-[10px] tracking-[0.4em] focus:border-editorial-accent focus:outline-none transition-all placeholder:text-editorial-text/10 text-editorial-text shadow-inner" 
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-editorial-text text-editorial-bg py-8 font-mono font-black uppercase tracking-[0.6em] text-[11px] hover:bg-editorial-accent transition-all duration-700 shadow-2xl active:scale-[0.98] disabled:opacity-50 relative group overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-1000" />
              {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
            </button>
          </form>

          {mode === 'user' && (
            <div className="space-y-8">
              <div className="flex items-center gap-6 py-6" >
                <div className="h-px flex-1 bg-editorial-border/30" />
                <span className="font-mono text-[8px] font-black uppercase tracking-[0.6em] text-editorial-text/10 italic">OAUTH SESSION</span>
                <div className="h-px flex-1 bg-editorial-border/30" />
              </div>
              
              <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full border border-editorial-border bg-transparent text-editorial-text/60 py-6 font-mono font-black uppercase tracking-[0.4em] text-[10px] hover:text-editorial-accent hover:border-editorial-accent transition-all duration-500 flex items-center justify-center gap-6 group cursor-pointer"
                >
                <div className="w-5 h-5 opacity-40 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all">
                  <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                CONTINUE WITH GOOGLE
              </button>
            </div>
          )}
          
          <div className="mt-12 pt-12 border-t border-editorial-border flex flex-col gap-4 text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/20 italic">
            <p className="hover:text-editorial-text transition-colors cursor-pointer tracking-widest">Forgot Credentials?</p>
            {mode === 'user' && <p className="hover:text-editorial-text transition-colors cursor-pointer tracking-widest" onClick={() => setMode('user')}>Establish New Identity</p>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AISuggestions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('Technology');

  const fetchSuggestions = async () => {
    setLoading(true);
    const data = await geminiService.getEventSuggestions(category);
    setSuggestions(data);
    setLoading(false);
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col lg:flex-row justify-between items-baseline gap-8 border-b border-editorial-border pb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-editorial-accent mb-4">Creative Engine</p>
          <h2 className="serif text-5xl font-light italic text-editorial-text tracking-tighter">AI Curator.</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
           <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="bg-editorial-bg border border-editorial-border text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 focus:ring-0 focus:outline-none text-editorial-text/60 appearance-none min-w-[150px]"
           >
             <option value="Technology">Technology</option>
             <option value="Arts">Arts</option>
             <option value="Finance">Finance</option>
             <option value="Music">Music</option>
           </select>
           <button 
            onClick={fetchSuggestions}
            disabled={loading}
            className="bg-editorial-accent text-editorial-bg px-8 py-3 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-editorial-text transition-all disabled:opacity-50"
           >
             {loading ? 'Synthesizing...' : 'Generate Concepts'}
           </button>
        </div>
      </div>

        <div className="grid md:grid-cols-3 gap-12">
        {suggestions.map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stat-card border border-editorial-border p-10 hover:border-editorial-accent/30 transition-all group"
          >
            <h4 className="serif text-2xl text-editorial-text italic mb-6 group-hover:text-editorial-accent transition-colors">{s.title}</h4>
            <p className="text-sm text-editorial-text/40 leading-relaxed italic mb-8 border-l border-editorial-accent/20 pl-6">{s.description}</p>
            <button className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 hover:text-editorial-accent transition-colors italic border-b border-transparent hover:border-editorial-accent pb-1 flex items-center gap-2">
              Adopt Concept <ArrowRight size={12} />
            </button>
          </motion.div>
        ))}
        {suggestions.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border border-dashed border-editorial-border">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/10 italic">Intelligence awaiting input.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateEvent({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    location: "",
    price: 0,
    totalCapacity: 100,
    category: "Summit",
    imageUrl: "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&q=80&w=1200"
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.title.trim().length > 3) {
        const keywords = formData.title.toLowerCase().split(' ').slice(0, 2).join(',');
        setFormData(prev => ({
          ...prev,
          imageUrl: `https://loremflickr.com/1200/800/${keywords || 'event,culture'}?lock=${formData.title.length}`
        }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.title]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (formData.title.trim().length < 5) newErrors.title = "Title must be at least 5 characters.";
    if (formData.description.trim().length < 20) newErrors.description = "Description must be more descriptive (min 20 chars).";
    if (!formData.date) newErrors.date = "Temporal coordinate is required.";
    else if (new Date(formData.date) < new Date()) newErrors.date = "Event must be scheduled in the future.";
    if (!formData.location.trim()) newErrors.location = "Locational vector is required.";
    if (formData.price < 0) newErrors.price = "Capital entrance cannot be negative.";
    if (formData.totalCapacity <= 0) newErrors.totalCapacity = "Capacity must be positive.";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validate()) return;
    setLoading(true);

    try {
      const eventData = {
        ...formData,
        price: Number(formData.price),
        totalCapacity: Number(formData.totalCapacity),
        remainingCapacity: Number(formData.totalCapacity),
        organizerId: user.uid,
        status: "upcoming",
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "events"), eventData);
      navigate("/dashboard/events");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "events");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl"
    >
      <header className="mb-24 border-b border-editorial-border/30 pb-20 relative">
        <button 
          onClick={() => navigate(-1)}
          className="absolute -top-16 left-0 font-mono text-[9px] font-black uppercase tracking-[0.6em] text-editorial-text/20 hover:text-editorial-accent transition-all flex items-center gap-4 cursor-pointer group"
        >
          <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-2 transition-transform" /> TERMINATE_GENESIS
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent mb-8 italic">INIT_NEW_CURATION_V2.5</p>
        <h1 className="serif text-8xl lg:text-9xl font-light tracking-tighter italic text-editorial-text leading-none">Event <br /><span className="text-editorial-text/5 italic">Genesis.</span></h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-16">
        <div className="aspect-video w-full bg-editorial-text/[0.02] border border-editorial-border overflow-hidden mb-16 group relative shadow-[0_0_50px_rgba(var(--editorial-accent-rgb),0.05)]">
          <img 
            id="event-preview-image"
            src={formData.imageUrl} 
            alt="Preview" 
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-1000 hover:scale-105" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-editorial-bg via-transparent to-transparent opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="text-center">
               <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-text/20 italic mb-2">Visual Identity System</p>
               <div className="h-px w-20 bg-editorial-accent/20 mx-auto" />
             </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-full border-[20px] border-editorial-bg/80 pointer-events-none group-hover:border-editorial-bg/40 transition-all duration-700" />
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Collection Title</label>
            <input 
              required
              type="text" 
              value={formData.title}
              onChange={e => {
                setFormData({...formData, title: e.target.value});
                if (errors.title) setErrors({...errors, title: ""});
              }}
              placeholder="THE UNTITLED PROJECT" 
              className={cn(
                "w-full bg-transparent border-b py-4 focus:outline-none transition-all serif text-2xl italic text-editorial-text placeholder:text-editorial-text/5",
                errors.title ? "border-red-500/50" : "border-editorial-border focus:border-editorial-accent"
              )}
            />
            {errors.title && <p className="text-[9px] text-red-500 uppercase tracking-widest">{errors.title}</p>}
          </div>
          <div className="space-y-4">
            <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Classification</label>
            <select 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full bg-transparent border-b border-editorial-border py-4 focus:outline-none focus:border-editorial-accent transition-all text-sm font-bold uppercase tracking-[0.3em] text-editorial-text"
            >
              <option value="Summit" className="bg-editorial-bg">Summit</option>
              <option value="Gala" className="bg-editorial-bg">Gala</option>
              <option value="Exhibition" className="bg-editorial-bg">Exhibition</option>
              <option value="Symphony" className="bg-editorial-bg">Symphony</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Narrative Description</label>
          <textarea 
            required
            rows={4}
            value={formData.description}
            onChange={e => {
              setFormData({...formData, description: e.target.value});
              if (errors.description) setErrors({...errors, description: ""});
            }}
            placeholder="A compelling vision for the attendees..." 
            className={cn(
              "w-full bg-transparent border-b py-4 focus:outline-none transition-all font-light text-xl italic leading-relaxed text-editorial-text/60 placeholder:text-editorial-text/5",
              errors.description ? "border-red-500/50" : "border-editorial-border focus:border-editorial-accent"
            )}
          />
          {errors.description && <p className="text-[9px] text-red-500 uppercase tracking-widest">{errors.description}</p>}
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Temporal Coordinate</label>
            <input 
              required
              type="datetime-local" 
              value={formData.date}
              onChange={e => {
                setFormData({...formData, date: e.target.value});
                if (errors.date) setErrors({...errors, date: ""});
              }}
              className={cn(
                "w-full bg-transparent border-b py-4 focus:outline-none transition-all text-sm font-bold uppercase tracking-[0.3em] text-editorial-text [color-scheme:dark]",
                errors.date ? "border-red-500/50" : "border-editorial-border focus:border-editorial-accent"
              )}
            />
            {errors.date && <p className="text-[9px] text-red-500 uppercase tracking-widest">{errors.date}</p>}
          </div>
          <div className="space-y-4">
            <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Locational Vector</label>
            <input 
              required
              type="text" 
              value={formData.location}
              onChange={e => {
                setFormData({...formData, location: e.target.value});
                if (errors.location) setErrors({...errors, location: ""});
              }}
              placeholder="BENGALURU OR NEW DELHI STUDIO" 
              className={cn(
                "w-full bg-transparent border-b py-4 focus:outline-none transition-all text-sm font-bold uppercase tracking-[0.3em] text-editorial-text placeholder:text-editorial-text/5",
                errors.location ? "border-red-500/50" : "border-editorial-border focus:border-editorial-accent"
              )}
            />
            {errors.location && <p className="text-[9px] text-red-500 uppercase tracking-widest">{errors.location}</p>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Entrance Capital (₹)</label>
            <input 
              required
              type="number" 
              value={formData.price}
              onChange={e => {
                setFormData({...formData, price: Number(e.target.value)});
                if (errors.price) setErrors({...errors, price: ""});
              }}
              min="0"
              className={cn(
                "w-full bg-transparent border-b py-4 focus:outline-none transition-all serif text-2xl italic text-editorial-text placeholder:text-editorial-text/5",
                errors.price ? "border-red-500/50" : "border-editorial-border focus:border-editorial-accent"
              )}
            />
            {errors.price && <p className="text-[9px] text-red-500 uppercase tracking-widest">{errors.price}</p>}
          </div>
          <div className="space-y-4">
            <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Patron Capacity</label>
            <input 
              required
              type="number" 
              value={formData.totalCapacity}
              onChange={e => {
                setFormData({...formData, totalCapacity: Number(e.target.value)});
                if (errors.totalCapacity) setErrors({...errors, totalCapacity: ""});
              }}
              min="1"
              className={cn(
                "w-full bg-transparent border-b py-4 focus:outline-none transition-all serif text-2xl italic text-editorial-text placeholder:text-editorial-text/5",
                errors.totalCapacity ? "border-red-500/50" : "border-editorial-border focus:border-editorial-accent"
              )}
            />
            {errors.totalCapacity && <p className="text-[9px] text-red-500 uppercase tracking-widest">{errors.totalCapacity}</p>}
          </div>
        </div>

        <button 
          disabled={loading}
          type="submit"
          className="w-full bg-editorial-text text-editorial-bg py-8 font-bold uppercase tracking-[0.4em] text-[10px] hover:bg-editorial-accent transition-all shadow-2xl disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Committing to Ledger...' : 'Initialize Collection'}
        </button>
      </form>
    </motion.div>
  );
}

function EventManagement({ events }: { events: Event[] }) {
  const navigate = useNavigate();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className="mb-24 border-b border-editorial-border/30 pb-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent mb-8 italic">SYSTEM.ARCHIVE_MANAGER_V1.1</p>
        <h1 className="serif text-8xl lg:text-9xl font-light tracking-tighter italic text-editorial-text leading-none">Your <br /><span className="text-editorial-text/5 italic">Collections.</span></h1>
      </header>

      <div className="grid gap-8">
        {events.length > 0 ? (
          events.map(event => (
            <div key={event.id} className="stat-card border border-editorial-border p-12 flex flex-col md:flex-row justify-between items-center gap-12 group hover:border-editorial-accent/20 transition-all">
              <div className="flex items-center gap-10">
                <div className="w-24 h-24 bg-editorial-text/5 border border-editorial-border overflow-hidden flex-shrink-0 grayscale group-hover:grayscale-0 transition-all duration-700">
                  <img src={event.imageUrl} alt="" className="w-full h-full object-cover opacity-60" />
                </div>
                <div>
                  <h3 className="serif text-3xl italic text-editorial-text mb-2">{event.title}</h3>
                  <div className="flex gap-6 text-[9px] font-bold uppercase tracking-[0.2em] text-editorial-text/20">
                     <span>{formatDate(event.date)}</span>
                     <span className="text-editorial-accent">{event.category}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-6 min-w-[200px]">
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/30 mb-2">Patronage</p>
                  <p className="text-xl serif italic text-editorial-text">{event.totalCapacity - event.remainingCapacity} / {event.totalCapacity}</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => navigate(`/events/${event.id}`)} className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 hover:text-editorial-text transition-colors cursor-pointer">Observe</button>
                  <button className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 hover:text-editorial-accent transition-colors cursor-pointer">Edit</button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-40 text-center border border-dashed border-editorial-border">
             <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/10 italic mb-8">No collections to display.</p>
             <button onClick={() => navigate('/dashboard/create')} className="text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-accent hover:text-editorial-text transition-colors border-b border-editorial-accent hover:border-editorial-text pb-2">Start Curation</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PatronsManagement({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [patrons, setPatrons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedEventId) {
      setPatrons([]);
      return;
    }
    setLoading(true);
    const regsRef = collection(db, 'events', selectedEventId, 'registrations');
    const unsubscribe = onSnapshot(regsRef, (snapshot) => {
      setPatrons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedEventId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className="flex flex-col lg:flex-row justify-between items-baseline gap-12 mb-20 border-b border-editorial-border pb-16">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-editorial-accent mb-6">Identity Registry</p>
          <h1 className="serif text-7xl lg:text-8xl font-light tracking-tighter italic text-editorial-text leading-none">Global <br /><span className="text-editorial-text/20">Patronage.</span></h1>
        </div>
        <div className="w-full lg:w-96">
           <select 
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-transparent border border-editorial-border px-6 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text focus:outline-none focus:border-editorial-accent transition-all"
            >
              <option value="" className="bg-editorial-bg">Select Collection...</option>
              {events.map(e => (
                <option key={e.id} value={e.id} className="bg-editorial-bg">{e.title}</option>
              ))}
            </select>
        </div>
      </header>

      {selectedEventId ? (
        <div className="stat-card border border-editorial-border overflow-hidden">
          <div className="p-12 border-b border-editorial-border flex justify-between items-center">
             <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Registry synchronization: {patrons.length} Identified Patrons.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-editorial-border text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/20">
                  <th className="px-12 py-8">Patron Identity</th>
                  <th className="px-12 py-8">Token</th>
                  <th className="px-12 py-8">Status</th>
                  <th className="px-12 py-8">Reception</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-editorial-text/[0.05]">
                {patrons.length > 0 ? (
                  patrons.map((p) => (
                    <tr key={p.id} className="hover:bg-editorial-text/[0.01] transition-colors">
                      <td className="px-12 py-8">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-editorial-text uppercase italic">{p.attendeeName || 'Unknown Identity'}</span>
                          <span className="text-[9px] text-editorial-text/20 tracking-widest">{p.attendeeEmail}</span>
                        </div>
                      </td>
                      <td className="px-12 py-8 font-mono text-[9px] text-editorial-text/40 tracking-widest uppercase">
                        {p.ticketId}
                      </td>
                      <td className="px-12 py-8">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-none border",
                          p.status === 'confirmed' ? "border-editorial-accent/20 text-editorial-accent bg-editorial-accent/5" : "border-editorial-border text-editorial-text/20"
                        )}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-12 py-8">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-[0.2em] italic flex items-center gap-2",
                          p.checkedIn ? "text-green-400" : "text-editorial-text/10"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", p.checkedIn ? "bg-green-400 animate-pulse" : "bg-editorial-text/10")} />
                          {p.checkedIn ? "Authorized Entry" : "Awaiting Registry"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-40 text-center italic text-editorial-text/10 text-[10px] font-bold uppercase tracking-[0.4em]">
                      No patron registry found for this collection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="stat-card border border-editorial-border border-dashed py-40 text-center">
           <Users className="mx-auto text-editorial-text/10 mb-8" size={64} />
           <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/20 italic">Select a collection to visualize hierarchy.</p>
        </div>
      )}
    </motion.div>
  );
}

function AnalyticsDashboard({ events }: { events: Event[] }) {
  const chartData = events.map(e => ({
    name: e.title.substring(0, 12).toUpperCase(),
    revenue: (e.totalCapacity - e.remainingCapacity) * e.price,
    patrons: e.totalCapacity - e.remainingCapacity,
    capacity: e.totalCapacity
  }));

  const pieData = events.reduce((acc: any[], e) => {
    const existing = acc.find(a => a.name === e.category);
    if (existing) {
      existing.value += (e.totalCapacity - e.remainingCapacity);
    } else {
      acc.push({ name: e.category, value: (e.totalCapacity - e.remainingCapacity) });
    }
    return acc;
  }, []);

  const COLORS = ['#88c0d0', '#5e81ac', '#81a1c1', '#4c566a'];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-24"
    >
      <header className="mb-24 border-b border-editorial-border/30 pb-20 relative">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-px bg-editorial-accent/30" />
           <p className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent italic">SYSTEM.COGNITIVE_ANALYTICS_V9.2</p>
        </div>
        <h1 className="serif text-8xl lg:text-9xl font-light tracking-tighter italic text-editorial-text leading-none">Insight <br /><span className="text-editorial-text/5 italic">Architecture.</span></h1>
        <p className="font-mono text-[9px] font-black text-editorial-text/20 uppercase tracking-[0.4em] ml-2 italic mt-4">DATA_HARVEST_CYCLE_COMPLETE_100%</p>
      </header>

      <div className="grid lg:grid-cols-12 gap-12 relative">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-8 stat-card p-12 border border-editorial-border bg-editorial-text/[0.005] shadow-inner group">
           <div className="flex justify-between items-start mb-16">
             <div>
                <h3 className="serif text-4xl text-editorial-text italic group-hover:text-editorial-accent transition-colors">Capital_Stream.</h3>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-text/20 mt-2">FISCAL_TRAJECTORY_MAPPING</p>
             </div>
             <div className="text-right">
                <p className="font-mono text-[10px] font-black text-green-500 uppercase tracking-widest">+12.4%</p>
                <p className="font-mono text-[8px] font-black text-editorial-text/10 uppercase tracking-widest italic">REL_PRIOR_PERIOD</p>
             </div>
           </div>
           
           <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#88c0d0" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#88c0d0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="10 10" stroke="#ffffff" strokeOpacity={0.03} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.1)" 
                    fontSize={7} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 'bold' }}
                    dy={20}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.1)" 
                    fontSize={7} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 'bold' }}
                    dx={-10}
                    tickFormatter={(val) => `₹${val/1000}K`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f1115', 
                      border: '1px solid rgba(255,255,255,0.05)', 
                      fontSize: '9px', 
                      color: '#eceff4',
                      fontFamily: 'JetBrains Mono',
                      letterSpacing: '0.1em'
                    }}
                    cursor={{ stroke: '#88c0d0', strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#88c0d0" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Patron Pie Chart */}
        <div className="lg:col-span-4 stat-card p-12 border border-editorial-border bg-editorial-text/[0.005] group">
           <h3 className="serif text-4xl text-editorial-text italic mb-2 group-hover:text-editorial-accent transition-colors">Patrons.</h3>
           <p className="font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-text/20 mb-16">DEMOGRAPHIC_SPLIT</p>
           
           <div className="h-[300px] w-full flex items-center justify-center relative">
              <div className="absolute font-mono text-[80px] font-black text-editorial-accent opacity-[0.02] pointer-events-none select-none italic">SPLIT</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f1115', 
                      border: '1px solid rgba(255,255,255,0.05)', 
                      fontSize: '9px',
                      fontFamily: 'JetBrains Mono'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
           </div>
           
           <div className="mt-12 space-y-6 pt-12 border-t border-editorial-border/30">
              {pieData.map((d: any, i: number) => (
                <div key={i} className="flex justify-between items-center group/item hover:bg-editorial-text/[0.02] p-2 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-1.5 h-1.5" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                     <span className="font-mono text-[9px] font-black uppercase tracking-[0.3em] text-editorial-text/30 group-hover/item:text-editorial-accent transition-colors italic">{d.name}</span>
                  </div>
                  <span className="font-mono text-xs font-black text-editorial-text/60 italic">{d.value}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Capacity Utilization Bar Chart */}
        <div className="lg:col-span-12 stat-card p-12 border border-editorial-border bg-editorial-text/[0.005] group">
           <div className="flex justify-between items-end mb-16">
              <div>
                <h3 className="serif text-4xl text-editorial-text italic group-hover:text-editorial-accent transition-colors">Resources.</h3>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-text/20 mt-2 italic">CAPACITY_UTILIZATION_METRIC</p>
              </div>
              <div className="flex gap-8 font-mono text-[8px] font-black uppercase tracking-[0.3em]">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-editorial-accent" />
                    <span className="text-editorial-text/40">ACTUAL_LOAD</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-editorial-border" />
                    <span className="text-editorial-text/40">THEORETICAL_MAX</span>
                 </div>
              </div>
           </div>
           
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={12}>
                  <CartesianGrid strokeDasharray="10 10" stroke="#ffffff" strokeOpacity={0.03} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.1)" 
                    fontSize={7} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 'bold' }}
                    dy={20}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.1)" 
                    fontSize={7} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 'bold' }}
                    dx={-10}
                  />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(255,255,255,0.02)'}}
                    contentStyle={{ 
                      backgroundColor: '#0f1115', 
                      border: '1px solid rgba(255,255,255,0.05)', 
                      fontSize: '9px',
                      fontFamily: 'JetBrains Mono'
                    }}
                  />
                  <Bar dataKey="patrons" fill="#88c0d0" radius={[0, 0, 0, 0]} barSize={24} />
                  <Bar dataKey="capacity" fill="rgba(255,255,255,0.05)" radius={[0, 0, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function EventWorkspace({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [narrative, setNarrative] = useState<{ vision: string; pillars: string[]; aesthetic: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const generateNarrative = async () => {
    if (!selectedEvent) return;
    setLoading(true);
    const result = await geminiService.generateEventNarrative(selectedEvent.title, selectedEvent.description);
    if (result) setNarrative(result);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-32"
    >
       <header className="flex flex-col lg:flex-row justify-between items-baseline gap-12 border-b border-editorial-border pb-16 relative">
          <div className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-editorial-accent mb-10 opacity-70 italic border-l-2 border-editorial-accent pl-6">Core Operational Directive</p>
            <h1 className="serif text-8xl lg:text-9xl font-light tracking-tighter italic text-editorial-text leading-none">The <br /><span className="text-editorial-text/5 italic">Manifesto.</span></h1>
          </div>
          <div className="flex flex-col gap-6 w-full lg:w-[400px] bg-editorial-text/[0.02] p-8 border border-editorial-border shadow-inner">
            <div className="space-y-3">
               <label className="text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 ml-1">Selection Matrix</label>
               <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-editorial-bg border border-editorial-border px-6 py-5 text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/80 focus:outline-none focus:border-editorial-accent transition-all appearance-none cursor-pointer hover:bg-editorial-text/[0.02]"
              >
                <option value="" className="bg-editorial-bg">Acknowledge Collection...</option>
                {events.map(e => (
                  <option key={e.id} value={e.id} className="bg-editorial-bg">{e.title}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={generateNarrative}
              disabled={loading || !selectedEventId}
              className="bg-editorial-text text-editorial-bg px-12 py-6 font-bold uppercase tracking-[0.5em] text-[10px] hover:bg-editorial-accent hover:shadow-2xl transition-all disabled:opacity-20 disabled:cursor-not-allowed relative group overflow-hidden"
            >
              <span className="relative z-10">{loading ? 'CONSULTING ENGINE...' : 'SYNTHESIZE STRATEGIC VISION'}</span>
              <div className="absolute inset-0 bg-editorial-accent -translate-x-full group-hover:translate-x-0 transition-transform duration-700 opacity-20" />
            </button>
          </div>
       </header>

       {!narrative && !loading && (
         <div className="stat-card border border-editorial-border p-32 text-center border-dashed bg-editorial-text/[0.01]">
            <Search className="mx-auto text-editorial-accent/20 mb-10" size={48} strokeWidth={1} />
            <p className="text-[11px] font-bold uppercase tracking-[0.6em] text-editorial-text/30 italic mb-10 max-w-lg mx-auto leading-loose">The narrative archive awaits a focal point for aesthetic synthesis. Engage the selector above to commence.</p>
            <button onClick={generateNarrative} className="text-editorial-accent text-[10px] font-black uppercase tracking-[0.5em] border-b border-editorial-accent/20 hover:border-editorial-accent transition-all pb-3 hover:tracking-[0.6em]">Initialize Core Analysis</button>
         </div>
       )}

       {loading && (
         <div className="grid lg:grid-cols-12 gap-12">
            {[1, 2, 3].map(i => (
              <div key={i} className="lg:col-span-4 h-[400px] bg-editorial-text/[0.02] border border-editorial-border animate-pulse relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              </div>
            ))}
         </div>
       )}

       {narrative && (
         <motion.div 
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1 }}
           className="space-y-40 pb-40"
         >
            <div className="grid lg:grid-cols-12 gap-20">
               <div className="lg:col-span-12">
                  <div className="stat-card border border-editorial-border p-20 lg:p-32 relative overflow-hidden group bg-editorial-card shadow-2xl">
                     <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
                          style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dust.png")' }} />
                     
                     <div className="max-w-5xl relative z-10">
                        <div className="flex items-center gap-6 mb-16">
                           <div className="h-[1px] w-20 bg-editorial-accent" />
                           <span className="text-[10px] font-black uppercase tracking-[0.6em] text-editorial-accent/60">Executive Abstract</span>
                        </div>
                        <h2 className="serif text-6xl lg:text-8xl italic text-editorial-text mb-16 leading-[0.9] tracking-tighter">The Visionary <br />Anchor.</h2>
                        <p className="text-3xl lg:text-4xl text-editorial-text/70 italic leading-snug font-light max-w-4xl border-l-[1px] border-editorial-accent/20 pl-16">
                           "{narrative.vision}"
                        </p>
                     </div>
                     <div className="absolute -top-40 -right-20 opacity-[0.03] pointer-events-none serif text-[50rem] font-black text-editorial-text uppercase leading-none select-none italic scale-110">
                        Ω
                     </div>
                  </div>
               </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-16">
               {narrative.pillars?.map((pillar: string, i: number) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="stat-card border border-editorial-border p-16 bg-editorial-text/[0.01] hover:bg-editorial-accent/[0.02] transition-colors relative group"
                  >
                    <div className="absolute top-8 left-8 text-[8px] font-black tracking-widest text-editorial-text/10 italic">0{i+1}.STRATEGY_NODE</div>
                    <p className="text-[10px] font-black uppercase tracking-[0.6em] text-editorial-accent mb-12 mt-4 italic border-b border-editorial-accent/10 pb-4 inline-block">Functional Pillar</p>
                    <p className="text-2xl text-editorial-text/80 italic leading-relaxed font-light">{pillar}</p>
                    <div className="mt-12 opacity-10 group-hover:opacity-40 transition-opacity">
                       <Activity size={12} strokeWidth={1} />
                    </div>
                  </motion.div>
               ))}
            </div>

            <div className="grid lg:grid-cols-12 gap-32 items-center">
               <div className="lg:col-span-12 mb-12">
                  <div className="h-px w-full bg-gradient-to-r from-editorial-accent/40 via-editorial-border to-transparent" />
               </div>
               <div className="lg:col-span-5 relative">
                  <div className="absolute -left-12 top-0 bottom-0 w-[1px] bg-editorial-accent/30" />
                  <p className="text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent mb-10 italic">Atmospheric Calculus</p>
                  <h3 className="serif text-6xl lg:text-7xl font-light italic text-editorial-text mb-12 leading-[0.95] tracking-tighter">Sensory <br />Architecture.</h3>
                  <p className="text-xl text-editorial-text/60 leading-relaxed italic font-light pr-12">
                    {narrative.aesthetic}
                  </p>
                  <div className="mt-16 flex gap-3">
                     {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 bg-editorial-text/10" />)}
                  </div>
               </div>
               <div className="lg:col-span-7 relative group">
                  <div className="absolute -inset-4 bg-editorial-accent/5 -z-10 group-hover:bg-editorial-accent/10 transition-colors duration-1000" />
                  <div className="aspect-[16/10] bg-editorial-card border border-editorial-border overflow-hidden shadow-2xl relative">
                    <img 
                      src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1200" 
                      alt="Atmospheric Reference" 
                      className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                    />
                    <div className="absolute inset-0 bg-editorial-accent/10 mix-blend-color opacity-30 pointer-events-none group-hover:opacity-0 transition-opacity duration-1000" />
                    <div className="absolute bottom-8 right-8 bg-editorial-bg/80 backdrop-blur-md p-4 border border-editorial-border">
                       <span className="text-[8px] font-black tracking-widest text-editorial-text/40 uppercase italic">Ref. Archive 712-B</span>
                    </div>
                  </div>
               </div>
            </div>
         </motion.div>
       )}
    </motion.div>
  );
}

// Dummy routes for now
function EventDiscovery({ events }: { events: Event[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

  const categories = ["All", ...Array.from(new Set(events.map(e => e.category)))];

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         e.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || e.category === selectedCategory;
    
    let matchesDate = true;
    if (dateRange.start) matchesDate = matchesDate && new Date(e.date) >= new Date(dateRange.start);
    if (dateRange.end) matchesDate = matchesDate && new Date(e.date) <= new Date(dateRange.end);
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  return (
    <div className="pt-40 pb-32 px-4 max-w-7xl mx-auto min-h-screen">
      <header className="mb-24 border-b border-editorial-border pb-20 relative">
        <div className="absolute -top-14 left-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.5em] text-editorial-accent/60 bg-editorial-accent/5 px-4 py-1.5 border border-editorial-border shadow-soft">ARCHIVE_V4.0_STABLE</span>
            <div className="h-px w-24 bg-editorial-border/30" />
          </div>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-end gap-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.6em] font-bold text-editorial-accent mb-8 italic flex items-center gap-3 px-4">
              <span className="w-8 h-px bg-editorial-accent/30" />
              DISCOVERY_AXIS
            </p>
            <h1 className="serif text-8xl lg:text-[10rem] font-light tracking-tighter italic text-editorial-text leading-none px-4">The <br /><span className="text-editorial-text/5 italic">Catalogue.</span></h1>
          </div>
          <div className="w-full lg:w-[450px] flex flex-col gap-10 px-4">
            <div className="flex items-center justify-between border-b border-editorial-border pb-6">
              <button 
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="hidden lg:flex items-center gap-3 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 hover:text-editorial-accent transition-all group"
              >
                {sidebarVisible ? <ChevronLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> : <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />}
                <span className="relative">
                  {sidebarVisible ? "COLLAPSE_FILTERS" : "EXTEND_FILTERS"}
                  <div className="absolute -bottom-1 left-0 w-0 h-px bg-editorial-accent/40 group-hover:w-full transition-all" />
                </span>
              </button>
              <div className="flex items-center gap-4 py-2 px-4 bg-green-500/5 border border-green-500/10">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                 <span className="font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-green-500/60">SYSTEM_NOMINAL_100%</span>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-4 text-editorial-text/20 group-focus-within:text-editorial-accent transition-colors">
                <Search size={16} strokeWidth={1.5} />
                <div className="w-px h-4 bg-editorial-border" />
              </div>
              <input 
                type="text" 
                placeholder="AUTHENTICATE_QUERY..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-editorial-border pl-14 pr-6 py-5 font-mono text-[10px] font-bold uppercase tracking-[0.3em] focus:border-editorial-accent focus:outline-none transition-all placeholder:text-editorial-text/10 text-editorial-text"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-16">
        {/* Sidebar */}
        <aside className={cn(
          "space-y-12 transition-all duration-700 ease-[0.16, 1, 0.3, 1]",
          sidebarVisible ? "lg:col-span-3 opacity-100" : "lg:col-span-0 opacity-0 w-0 pointer-events-none absolute -translate-x-full"
        )}>
          <div className="space-y-8">
            <div className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-accent/50 flex items-center gap-4">
              <span>CATEGORIES</span>
              <div className="h-px flex-1 bg-editorial-accent/10" />
            </div>
            <nav className="flex flex-col gap-1.5 border-none pr-2 mr-0">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={cn(
                    "group flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-[0.3em] py-3.5 px-5 transition-all cursor-pointer relative overflow-hidden",
                    selectedCategory === c 
                      ? "text-editorial-bg" 
                      : "text-editorial-text/40 hover:text-editorial-text hover:bg-editorial-text/[0.04]"
                  )}
                >
                  {selectedCategory === c && (
                    <motion.div 
                      layoutId="activeCategory"
                      className="absolute inset-0 bg-editorial-accent z-0"
                      transition={{ type: "spring", bounce: 0, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    {c}
                  </span>
                  <span className={cn(
                    "relative z-10 text-[8px] font-mono opacity-30 uppercase tracking-widest",
                    selectedCategory === c && "opacity-70 text-editorial-bg"
                  )}>
                    {String(c === "All" ? events.length : events.filter(e => e.category === c).length).padStart(2, '0')}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-10">
            <div className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-accent/50 mb-6 flex items-center gap-4">
              <span>TIME RANGE</span>
              <div className="h-px flex-1 bg-editorial-accent/10" />
            </div>
            <div className="space-y-8 px-1">
               <div className="space-y-2">
                  <label className="font-mono text-[7px] font-black uppercase tracking-[0.4em] text-editorial-text/20 ml-1">START DATE</label>
                  <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full bg-transparent border border-editorial-border/40 px-5 py-4 font-mono text-[9px] font-bold text-editorial-text uppercase tracking-widest focus:border-editorial-accent focus:outline-none transition-all placeholder:text-editorial-text/5"
                  />
               </div>
               <div className="space-y-2">
                  <label className="font-mono text-[7px] font-black uppercase tracking-[0.4em] text-editorial-text/20 ml-1">END DATE</label>
                  <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full bg-transparent border border-editorial-border/40 px-5 py-4 font-mono text-[9px] font-bold text-editorial-text uppercase tracking-widest focus:border-editorial-accent focus:outline-none transition-all placeholder:text-editorial-text/5"
                  />
               </div>
               {(dateRange.start || dateRange.end) && (
                 <button 
                  onClick={() => setDateRange({ start: "", end: "" })}
                  className="w-full py-4 border border-editorial-accent/20 font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-accent hover:bg-editorial-accent hover:text-editorial-bg transition-all flex items-center justify-center gap-2 group mt-4 overflow-hidden relative"
                 >
                   <span className="relative z-10">CLEAR RANGE</span>
                   <div className="absolute inset-0 bg-editorial-accent translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                 </button>
               )}
            </div>
          </div>

          <div className="pt-10">
            <div className="stat-card p-8 border border-editorial-border/30 bg-editorial-bg/40 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Activity size={40} strokeWidth={1} />
              </div>
              <p className="font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-accent/40 mb-6 flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-editorial-accent animate-pulse" />
                SYSTEM STATUS
              </p>
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-[7px] font-mono text-editorial-text/20 uppercase tracking-widest">LOG_SYNC</span>
                  <span className="text-[8px] font-mono text-editorial-accent">NOMINAL</span>
                </div>
                <div className="h-0.5 bg-editorial-border/10">
                  <motion.div 
                    animate={{ width: ["20%", "60%", "35%"] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    className="h-full bg-editorial-accent/30" 
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "transition-all duration-700 ease-[0.215, 0.61, 0.355, 1]",
          sidebarVisible ? "lg:col-span-9" : "lg:col-span-12"
        )}>
          <div className="flex items-center justify-between mb-12 border-b border-editorial-border pb-6 px-4">
             <div className="flex items-center gap-6">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">
                  RESULTS_FOUND: <span className="text-editorial-accent">{String(filteredEvents.length).padStart(2, '0')}</span>
                </p>
                <div className="h-4 w-px bg-editorial-border" />
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">
                  STATUS: <span className={cn(filteredEvents.length > 0 ? "text-green-500/60" : "text-yellow-500/60")}>{filteredEvents.length > 0 ? "NOMINAL" : "VOID_SEARCH"}</span>
                </p>
             </div>
             <div className="flex gap-4">
                <div className="w-2 h-2 bg-editorial-accent/20 rounded-full animate-ping" />
                <div className="w-2 h-2 bg-editorial-accent/20 rounded-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]" />
             </div>
          </div>

          <div className={cn(
            "grid gap-x-12 gap-y-20 transition-all duration-500 px-4",
            sidebarVisible ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
          )}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event, idx) => (
                <EventCard key={event.id} event={event} index={idx} />
              ))
            ) : (
              <div className="col-span-full stat-card border border-editorial-border border-dashed p-32 text-center bg-editorial-bg shadow-inner">
                 <Search className="mx-auto text-editorial-accent/5 mb-8" size={100} strokeWidth={0.5} />
                 <p className="serif text-3xl italic text-editorial-text uppercase tracking-tighter mb-6">No matches found.</p>
                 <p className="font-mono text-[10px] font-bold uppercase tracking-[0.5em] text-editorial-text/20 max-w-sm mx-auto leading-relaxed italic">
                   We couldn't find any events matching your selected criteria. Please adjust your filters.
                 </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function EventDetails({ events, user }: { events: Event[]; user: User | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const event = events.find(e => e.id === id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);
  const [registration, setRegistration] = useState<any | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!user || !id) return;
    const regId = `${id}_${user.uid}`;
    const regRef = doc(db, 'events', id, 'registrations', regId);
    const unsubscribe = onSnapshot(regRef, (doc) => {
      if (doc.exists()) {
        setRegistration({ id: doc.id, ...doc.data() });
      } else {
        setRegistration(null);
      }
    });
    return () => unsubscribe();
  }, [user, id]);

  if (!event) {
    return (
      <div className="pt-40 text-center px-4">
        <h2 className="serif text-5xl text-editorial-text uppercase italic mb-8">Collection not found</h2>
        <p className="text-editorial-text/40 text-[10px] font-bold uppercase tracking-[0.4em] mb-12 italic">The requested artifact has been archived or does not exist.</p>
        <Link to="/events" className="bg-editorial-accent text-editorial-bg px-12 py-4 text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-editorial-text transition-all inline-block">Return to Catalogue</Link>
      </div>
    );
  }

  const handleRegistration = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);

        if (!eventSnap.exists()) throw new Error("Event does not exist.");

        const eventData = eventSnap.data() as Event;
        if (eventData.remainingCapacity <= 0) throw new Error("Event is sold out.");

        const regId = `${event.id}_${user.uid}`;
        const regRef = doc(db, 'events', event.id, 'registrations', regId);
        const regSnap = await transaction.get(regRef);

        if (regSnap.exists() && regSnap.data().status === 'confirmed') {
          throw new Error("You are already registered for this event.");
        }

        const ticketId = `TIC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const globalRegRef = doc(db, 'global_registrations', regId);
        transaction.set(globalRegRef, {
          eventId: event.id,
          attendeeId: user.uid,
          attendeeEmail: user.email,
          attendeeName: user.displayName,
          purchaseDate: serverTimestamp(),
          status: 'confirmed',
          ticketId,
          checkedIn: false
        });

        transaction.set(regRef, {
          eventId: event.id,
          attendeeId: user.uid,
          attendeeEmail: user.email,
          attendeeName: user.displayName,
          purchaseDate: serverTimestamp(),
          status: 'confirmed',
          ticketId,
          checkedIn: false
        });

        transaction.update(eventRef, {
          remainingCapacity: increment(-1)
        });
      });

      setMessage({ 
        type: 'success', 
        text: 'Successful registration! An email with your event QR code has been dispatched to your registry.' 
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Registration failed.' });
      handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/registrations`);
    } finally {
      setLoading(false);
    }
  };

  const handleWaitlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const waitlistId = `${event.id}_${user.uid}`;
      const waitlistRef = doc(db, 'events', event.id, 'waitlist', waitlistId);
      
      await setDoc(waitlistRef, {
        eventId: event.id,
        attendeeId: user.uid,
        joinedAt: serverTimestamp(),
        status: 'waiting'
      });

      setMessage({ type: 'success', text: 'You have been added to the priority waitlist. We will contact you via email if a slot opens.' });
      setShowWaitlist(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Waitlist entry failed.' });
      handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/waitlist`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="pt-40 px-4 max-w-7xl mx-auto min-h-screen">
      <Link to="/events" className="inline-flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/40 hover:text-editorial-accent transition-colors mb-16 underline decoration-editorial-text/10 underline-offset-8">
        <ArrowRight size={14} className="rotate-180" />
        Return to Collections
      </Link>

      <div className="grid lg:grid-cols-12 gap-20">
        <div className="lg:col-span-8">
          <div className="aspect-video bg-editorial-card overflow-hidden mb-16 border border-editorial-border shadow-2xl relative">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-t from-editorial-bg via-transparent to-transparent opacity-40" />
          </div>
          
          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.6em] text-editorial-accent">Collection {event.id.substring(0, 3).padStart(3, '0')}</span>
              <h1 className="serif text-7xl lg:text-8xl font-light tracking-tighter italic leading-tight text-editorial-text uppercase">
                {event.title}
              </h1>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 py-12 border-y border-editorial-border text-[10px] font-bold uppercase tracking-[0.3em] italic">
              <div>
                <p className="text-editorial-accent mb-4 not-italic font-bold tracking-[0.4em]">Temporal</p>
                <p className="text-editorial-text/80">{formatDate(event.date)}</p>
              </div>
              <div>
                <p className="text-editorial-accent mb-4 not-italic font-bold tracking-[0.4em]">Locational</p>
                <p className="text-editorial-text/80">{event.location}</p>
              </div>
              <div>
                <p className="text-editorial-accent mb-4 not-italic font-bold tracking-[0.4em]">Category</p>
                <p className="text-editorial-text/80">{event.category}</p>
              </div>
              <div>
                <p className="text-editorial-accent mb-4 not-italic font-bold tracking-[0.4em]">Organized On</p>
                <p className="text-editorial-text/80">{formatDate(event.createdAt || new Date().toISOString())}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-12 border-b border-editorial-border">
              <div className="space-y-8">
                <h3 className="serif text-3xl text-editorial-text italic">Event Highlights</h3>
                <ul className="space-y-4">
                  {(event.highlights || [
                    "Exclusive networking session with industry architects.",
                    "Live demonstration of cutting-edge technology stacks.",
                    "Curated gourmet experience reflecting local heritage.",
                    "High-fidelity visual environment and immersive soundscapes."
                  ]).map((h, i) => (
                    <li key={i} className="flex gap-4 items-baseline">
                      <span className="text-editorial-accent text-[10px] font-bold">0{i+1} /</span>
                      <p className="text-sm text-editorial-text/50 italic leading-relaxed">{h}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-8">
                <h3 className="serif text-3xl text-editorial-text italic">Attendance Matrix</h3>
                <div className="stat-card p-10 border border-editorial-border">
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/30">Total Attendance</p>
                    <p className="text-xl serif text-editorial-text italic">{event.attendanceCount || (event.totalCapacity - event.remainingCapacity)} Entrants</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/30">Registry Capacity</p>
                    <p className="text-xl serif text-editorial-text italic">{event.totalCapacity} Total Units</p>
                  </div>
                  <div className="mt-8 pt-8 border-t border-editorial-border">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/30 mb-2">Growth Projection</p>
                    <div className="flex items-center gap-4">
                      <TrendingUp className="text-editorial-accent" size={16} />
                      <span className="text-[10px] font-bold text-editorial-accent uppercase tracking-[0.2em]">+24% Global Reach</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="font-light text-2xl lg:text-3xl leading-relaxed text-editorial-text/50 italic py-8 border-b border-editorial-border">
              <p className="mb-12 leading-normal">{event.description}</p>
            </div>

            {registration && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-12 space-y-12"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-full bg-editorial-accent/20 flex items-center justify-center text-editorial-accent">
                    <Activity size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-accent italic">Live Registry Feed</p>
                    <h3 className="serif text-4xl text-editorial-text italic">Event Protocol Schedule</h3>
                  </div>
                </div>

                <div className="grid gap-6">
                  {(event.schedule || [
                    { time: "09:00 AM", activity: "Identity Verification & Welcome Reception" },
                    { time: "10:30 AM", activity: "Keynote Address: Architectural Vision" },
                    { time: "01:00 PM", activity: "Curation Luncheon & Networking" },
                    { time: "03:00 PM", activity: "Breakout Modules: Innovation Lab" },
                    { time: "06:00 PM", activity: "Closing Plenary & Cocktail Hour" }
                  ]).map((item, i) => (
                    <div key={i} className="flex gap-12 p-8 border border-editorial-border hover:bg-editorial-accent/[0.03] transition-all group">
                      <div className="w-32">
                        <p className="text-[10px] font-bold text-editorial-accent group-hover:scale-110 transition-transform">{item.time}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-lg text-editorial-text/70 italic group-hover:text-editorial-text transition-colors">{item.activity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="stat-card p-12 border border-blue-500/20 bg-blue-500/5 flex flex-col sm:flex-row items-center justify-between gap-8">
                  <div>
                    <h4 className="serif text-2xl text-blue-400 italic mb-2">Internal Communication Channel</h4>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-editorial-text/30">Direct Link to Event Management Team</p>
                  </div>
                  <a href={`https://wa.me/917981648202?text=Inquiry regarding ${event.title}`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-8 py-3 text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-blue-500 transition-all w-full sm:w-auto text-center">
                    Initiate Signal
                  </a>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <aside className="lg:col-span-4 relative">
          <div className="sticky top-40 space-y-8">
            <div className="stat-card p-12 border border-editorial-border space-y-8">
              <div className="flex justify-between items-baseline">
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Ticket Fee</p>
                <p className="text-2xl serif text-editorial-accent italic">
                  ₹{event.price.toLocaleString()}
                </p>
              </div>
              <div className="flex justify-between items-baseline pt-8 border-t border-editorial-border">
                <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">Availability</p>
                <p className="text-[10px] font-bold text-editorial-accent italic uppercase tracking-[0.2em]">
                  {event.remainingCapacity} / {event.totalCapacity} Units
                </p>
              </div>
              <div className="w-full h-1 bg-editorial-text/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(1 - event.remainingCapacity / event.totalCapacity) * 100}%` }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                  className="h-full bg-editorial-accent" 
                />
              </div>
            </div>

            {registration ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="stat-card p-12 border border-editorial-accent/30 shadow-2xl bg-editorial-accent/5 overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-4">
                  <div className="w-2 h-2 rounded-full bg-editorial-accent animate-ping" />
                </div>
                
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-editorial-accent mb-10">Confirmed Patron</p>
                
                <div className="flex flex-col items-center gap-10 mb-10">
                   <div className="p-4 bg-[#ffffff] rounded-none border-4 border-editorial-accent shadow-2xl">
                      <QRCodeCanvas 
                        value={registration.ticketId} 
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/30 mb-2">Access Token</p>
                     <p className="serif text-2xl text-editorial-text italic tracking-widest">{registration.ticketId}</p>
                   </div>
                </div>

                <div className="space-y-6 border-t border-editorial-border pt-8">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.2em]">
                    <span className="text-editorial-text/30">Entry Status</span>
                    <span className={cn(registration.checkedIn ? "text-green-400" : "text-editorial-accent")}>
                      {registration.checkedIn ? "Verified Entry" : "Pending Arrival"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.2em]">
                    <span className="text-editorial-text/30">PATRON ID</span>
                    <span className="text-editorial-text/60">{user?.email}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-10">
                  <button 
                    onClick={handleShare}
                    className="flex items-center justify-center gap-3 py-4 border border-editorial-border hover:bg-editorial-text/5 transition-colors text-[8px] font-bold uppercase tracking-[0.3em] text-editorial-text/40 cursor-pointer"
                  >
                    <Share2 size={12} className={cn(copied && "text-editorial-accent animate-pulse")} />
                    {copied ? "Link Copied" : "Share"}
                  </button>
                  <Link 
                    to="/profile"
                    className="flex items-center justify-center gap-3 py-4 border border-editorial-border hover:bg-editorial-text/5 transition-colors text-[8px] font-bold uppercase tracking-[0.3em] text-editorial-text/40"
                  >
                    Digital Pass
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="stat-card p-12 border border-editorial-border shadow-2xl">
                {message && (
                  <div className={cn(
                    "p-6 text-[10px] font-bold uppercase tracking-[0.2em] mb-10 border",
                    message.type === 'success' ? "bg-editorial-accent/10 border-editorial-accent/30 text-editorial-accent" : 
                    message.type === 'info' ? "bg-editorial-text/5 border-editorial-border text-editorial-text/60" :
                    "bg-red-500/10 border-red-500/30 text-red-500"
                  )}>
                    {message.text}
                  </div>
                )}

                <div className="flex flex-col gap-8 mb-12">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/30">Admission Fee</h3>
                  <span className="serif text-6xl font-normal text-editorial-accent italic">{event.price === 0 ? "Complimentary" : formatCurrency(event.price)}</span>
                </div>

                {event.remainingCapacity > 0 ? (
                  <button 
                    onClick={handleRegistration}
                    disabled={loading}
                    className="w-full bg-editorial-text text-editorial-bg py-6 font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-editorial-accent transition-colors shadow-xl disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Processing...' : 'Register Now'}
                  </button>
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 text-center py-4 border border-editorial-border italic">
                      Capacity Exhausted
                    </div>
                    <button 
                      onClick={() => setShowWaitlist(true)}
                      disabled={loading}
                      className="w-full bg-editorial-accent text-editorial-bg py-6 font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-editorial-text transition-colors shadow-2xl shadow-editorial-accent/20 disabled:opacity-50 cursor-pointer"
                    >
                      Join Waitlist
                    </button>
                  </div>
                )}

                <div className="mt-12 grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleShare} 
                    className="flex items-center justify-center gap-3 py-4 border border-editorial-border hover:bg-editorial-text/5 transition-colors text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/40 cursor-pointer"
                  >
                    <Share2 size={12} className={cn(copied && "text-editorial-accent animate-pulse")} />
                    {copied ? "Link Copied" : "Share Event"}
                  </button>
                  <button className="flex items-center justify-center gap-3 py-4 border border-editorial-border hover:bg-editorial-text/5 transition-colors text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/40 cursor-pointer">
                    <Plus size={12} /> Portfolio
                  </button>
                </div>
              </div>
            )}
            
            <div className="stat-card p-10 border border-editorial-border relative overflow-hidden group">
               <MapPin className="absolute -right-4 -bottom-4 text-editorial-text/5 transition-all group-hover:scale-125 duration-1000" size={120} />
               <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 mb-4">Location Context</p>
               <p className="text-editorial-text/60 text-sm leading-relaxed italic font-light relative z-10">
                 {event.location} Studio — A premier space dedicated to curated gatherings and intellectual exchange.
               </p>
            </div>
          </div>
        </aside>
      </div>


      <AnimatePresence>
        {showWaitlist && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWaitlist(false)}
              className="absolute inset-0 bg-editorial-bg/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="stat-card border border-editorial-border w-full max-w-xl p-20 relative z-10 shadow-2xl"
            >
              <button onClick={() => setShowWaitlist(false)} className="absolute top-8 right-8 text-editorial-text/20 hover:text-editorial-text transition-colors cursor-pointer">
                <X size={24} />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 border border-editorial-accent text-editorial-accent rounded-full flex items-center justify-center mb-10 shadow-2xl shadow-editorial-accent/10">
                  <Bell size={24} />
                </div>
                <h3 className="serif text-5xl font-light tracking-tighter mb-6 italic text-editorial-text leading-tight uppercase">Priority <br />Waitlist.</h3>
                <p className="text-editorial-text/40 mb-12 font-light text-lg italic leading-relaxed">
                  Join the queue for the {event.title} collection. We will notify your registered email when a vacancy occurs.
                </p>
                <div className="w-full p-4 border border-editorial-border bg-editorial-text/5 text-[10px] font-bold uppercase tracking-[0.3em] text-editorial-text/60 mb-10">
                  {user?.email || 'Unauthorized Identity'}
                </div>
                <button 
                  onClick={handleWaitlist}
                  disabled={loading}
                  className="w-full bg-editorial-text text-editorial-bg py-6 font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-editorial-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Joining...' : 'Confirm Position'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dashboard({ events, user, onOpenBooking }: { events: Event[]; user: User | null; onOpenBooking: (type?: string) => void }) {
  const userEvents = events.filter(e => e.organizerId === user?.uid);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  return (
    <div className={cn(
      "min-h-screen bg-editorial-bg pt-24 lg:pt-0 transition-all duration-700 ease-[0.215, 0.61, 0.355, 1]",
      sidebarVisible ? "lg:pl-72" : "lg:pl-0"
    )}>
      {/* Sidebar Toggle Button - Clinical Style */}
      <button 
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className={cn(
          "fixed top-40 left-0 z-40 bg-editorial-text text-editorial-bg p-4 border-y border-r border-editorial-border hover:bg-editorial-accent transition-all duration-700 shadow-2xl",
          !sidebarVisible ? "translate-x-0" : "translate-x-72"
        )}
      >
        {sidebarVisible ? <ChevronLeft size={14} strokeWidth={1} /> : <ChevronRight size={14} strokeWidth={1} />}
      </button>

      {/* Sidebar - Technical Directorate Aesthetic */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-72 bg-editorial-card border-r border-editorial-border lg:flex flex-col p-8 lg:p-10 z-20 transition-transform duration-700 ease-[0.215, 0.61, 0.355, 1]",
        sidebarVisible ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mb-12 flex items-center justify-between">
          <div>
            <Link to="/" className="serif text-2xl font-light tracking-[-0.05em] text-editorial-text italic uppercase hover:text-editorial-accent transition-colors">Aahwanam</Link>
          </div>
        </div>
        
        <nav className="flex-1 space-y-12 overflow-y-auto pr-2">
          <div className="space-y-2">
            <div className="flex items-center gap-4 px-4 mb-4">
               <div className="w-4 h-px bg-editorial-accent/20" />
               <p className="font-mono text-[7px] font-black uppercase tracking-[0.4em] text-editorial-text/20">CORE WORKSPACE</p>
            </div>
            <DashboardLink to="/dashboard" label="Overview" active={location.pathname === '/dashboard'} />
            <DashboardLink to="/dashboard/workspace" label="Vision Studio" active={location.pathname === '/dashboard/workspace'} />
            <DashboardLink to="/dashboard/events" label="Archives" active={location.pathname === '/dashboard/events'} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-4 px-4 mb-4">
               <div className="w-4 h-px bg-editorial-accent/20" />
               <p className="font-mono text-[7px] font-black uppercase tracking-[0.4em] text-editorial-text/20">OPERATIONS GRID</p>
            </div>
            <DashboardLink to="/dashboard/collaboration" label="Studio Sync" active={location.pathname === '/dashboard/collaboration'} />
            <DashboardLink to="/dashboard/ai" label="AI Curator" active={location.pathname === '/dashboard/ai'} />
            <DashboardLink to="/dashboard/checkin" label="Reception Log" active={location.pathname === '/dashboard/checkin'} />
            <button 
              onClick={() => onOpenBooking()}
              className="w-full flex items-center justify-between px-6 py-4 bg-editorial-accent text-editorial-bg hover:bg-editorial-text transition-colors duration-500 group shadow-xl"
            >
               <div className="flex items-center gap-4">
                  <Sparkles size={14} />
                  <span className="font-mono text-[9px] font-black uppercase tracking-[0.3em]">Launch_Mandate</span>
               </div>
               <Plus size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-4 px-4 mb-4">
               <div className="w-4 h-px bg-editorial-accent/20" />
               <p className="font-mono text-[7px] font-black uppercase tracking-[0.4em] text-editorial-text/20">INTELLIGENCE CORE</p>
            </div>
            <DashboardLink to="/dashboard/attendees" label="Patron Archive" active={location.pathname === '/dashboard/attendees'} />
            <DashboardLink to="/dashboard/analytics" label="Quant Insights" active={location.pathname === '/dashboard/analytics'} />
          </div>
        </nav>
        
        <div className="mt-auto pt-10 border-t border-editorial-border/30 space-y-10">
          <div className="px-4">
             <div className="p-5 bg-editorial-text/[0.01] border border-editorial-border/40 flex justify-between items-center group cursor-help relative overflow-hidden">
                <div className="absolute inset-0 bg-editorial-accent opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-[0.4em] text-editorial-text/20 italic">SIGNAL STABILITY</span>
                <div className="flex gap-2 items-center">
                   <div className="w-1.5 h-1.5 bg-editorial-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
                   <span className="font-mono text-[8px] font-bold text-editorial-accent">98.4%</span>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-5 group cursor-pointer px-4 pb-4" onClick={() => navigate('/profile')}>
            <div className="w-12 h-12 rounded-none bg-editorial-bg border border-editorial-border overflow-hidden relative group-hover:border-editorial-accent transition-colors duration-500">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all duration-700" />
               ) : (
                 <UserCircle2 className="w-full h-full p-3 text-editorial-text/20" />
               )}
               <div className="absolute inset-0 border-[4px] border-white/0 group-hover:border-editorial-accent/10 transition-all duration-700" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-editorial-text group-hover:text-editorial-accent transition-colors truncate italic">
                {user?.displayName || user?.email?.split('@')[0]}
              </p>
              <p className="font-mono text-[7px] font-bold uppercase tracking-[0.5em] text-editorial-accent/30 mt-1 italic">VERIFIED ACCOUNT</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="p-8 sm:p-12 lg:p-20">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route index element={<DashboardOverview events={userEvents} onOpenBooking={onOpenBooking} />} />
            <Route path="workspace" element={<EventWorkspace events={userEvents} />} />
            <Route path="collaboration" element={<CollaborationWorkspace events={userEvents} />} />
            <Route path="ai" element={<AISuggestions />} />
            <Route path="checkin" element={<CheckInSystem user={user} events={userEvents} />} />
            <Route path="create" element={<CreateEvent user={user} />} />
            <Route path="events" element={<EventManagement events={userEvents} />} />
            <Route path="attendees" element={<PatronsManagement events={userEvents} />} />
            <Route path="analytics" element={<AnalyticsDashboard events={userEvents} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function DashboardOverview({ events, onOpenBooking }: { events: Event[]; onOpenBooking: (type?: string) => void }) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Historical data to reflect 2 years of growth
  const revenueHistory: SparkPoint[] = [
    { name: 'Q1 24', value: 1200000 },
    { name: 'Q2 24', value: 2400000 },
    { name: 'Q3 24', value: 1800000 },
    { name: 'Q4 24', value: 3600000 },
    { name: 'Q1 25', value: 4200000 },
    { name: 'Q2 25', value: 5800000 },
  ];

  const patronHistory: SparkPoint[] = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 850 },
    { name: 'Mar', value: 1200 },
    { name: 'Apr', value: 2100 },
    { name: 'May', value: 3400 },
    { name: 'Jun', value: 4200 },
  ];

  const categoryData: PerformanceMetric[] = [
    { name: 'Weddings', value: 40, color: 'var(--accent)' },
    { name: 'Corporate', value: 35, color: '#94a3b8' },
    { name: 'College', value: 25, color: '#f87171' },
  ];

  const activityLogs: ActivityLog[] = [
    { type: 'SUCCESS', msg: 'Corporate Meetup completed in Bangalore', date: 'Feb 2026', city: 'Bangalore' },
    { type: 'SUCCESS', msg: 'Wedding Event successfully hosted in Hyderabad', date: 'Jan 2026', city: 'Hyderabad' },
    { type: 'INFO', msg: 'New client booking received for Q3 Summit', date: 'March 2026', city: 'Mumbai' },
    { type: 'INFO', msg: 'Venue partnership secured: Taj Lands End', date: 'Feb 2026', city: 'Mumbai' },
  ];

  const topClients: ClientSnapshot[] = [
    { name: 'Reliance Industries', events: 12, value: '₹4.2M' },
    { name: 'TCS Global', events: 8, value: '₹2.8M' },
    { name: 'IIT Madras', events: 5, value: '₹1.5M' },
    { name: 'Splendor Weddings', events: 15, value: '₹6.4M' },
  ];

  const totalRevenue = events.reduce((acc, e) => acc + (e.price * (e.totalCapacity - e.remainingCapacity)), 0) + 12400000;
  const totalPatrons = events.reduce((acc, e) => acc + (e.totalCapacity - e.remainingCapacity), 0) + 8420;
  const historicalEventsCount = 126;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="pb-32 relative"
    >
      <header className="flex flex-col lg:flex-row justify-between items-end gap-16 mb-24 border-b border-editorial-border pb-20 relative">
        <div className="absolute -top-14 -left-4 bg-editorial-accent/5 px-6 py-2 border border-editorial-border backdrop-blur-xl flex items-center gap-4 shadow-soft">
          <div className="w-2 h-2 bg-editorial-accent rounded-none animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.5em] text-editorial-accent">EST_2024 — OPS_EXCELLENCE_STABLE</span>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent mb-8 mt-6 opacity-40 italic flex items-center gap-3">
            <span className="w-12 h-px bg-editorial-accent/20" />
            OPERATIONAL_INTELLIGENCE_CENTER
          </p>
          <motion.h1 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="serif text-8xl lg:text-[9.5rem] font-light tracking-tighter italic text-editorial-text leading-[0.85] py-2"
          >
            Director's <br /><span className="text-editorial-text/5 italic">Cabinet.</span>
          </motion.h1>
        </div>
        <div className="flex gap-6 mb-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/dashboard/analytics')}
            className="group relative border border-editorial-border text-editorial-text/40 px-12 py-6 font-mono font-black uppercase tracking-[0.4em] text-[10px] hover:text-editorial-accent transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-editorial-accent/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <div className="relative flex items-center gap-4">
              <Activity size={14} className="opacity-40 group-hover:opacity-100" />
              DIAGNOSTICS_SYS
            </div>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpenBooking()}
            className="group relative bg-editorial-text text-editorial-bg px-12 py-6 font-mono font-black uppercase tracking-[0.4em] text-[10px] hover:bg-editorial-accent hover:text-editorial-bg transition-all shadow-xl overflow-hidden"
          >
            <div className="relative flex items-center gap-4">
              <Plus size={16} />
              MANDATE_INIT
            </div>
          </motion.button>
        </div>
      </header>

      <motion.div 
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.08 } }
        }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-24 px-4 lg:px-0"
      >
        <StatCard label="GROSS CAPITAL REVENUE" numValue={totalRevenue} prefix="₹" delta="+42.8%" sparkData={revenueHistory} />
        <StatCard label="NETWORK PATRONS" numValue={totalPatrons} delta="+124%" sparkData={patronHistory} />
        <StatCard label="ARCHIVED COLLECTIONS" numValue={historicalEventsCount} delta="+18%" isGrowth={true} />
        <StatCard label="OPERATIONAL EFFICIENCY" numValue={92} suffix="%" delta="+5.2%" isGrowth={true} />
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-12 mb-12">
        {/* Activity Feed */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="stat-card border border-editorial-border bg-editorial-card p-12 lg:col-span-1 shadow-soft group"
        >
          <div className="flex items-center justify-between mb-12 border-b border-editorial-border pb-6">
            <h3 className="font-mono text-[9px] font-black uppercase tracking-[0.5em] text-editorial-text/20 group-hover:text-editorial-accent transition-colors flex items-center gap-4">
               PULSE_MONITOR.LOG
            </h3>
            <div className="w-2 h-2 bg-editorial-accent rounded-none animate-pulse" />
          </div>
          <div className="space-y-10">
            {activityLogs.map((log, i) => (
              <div key={i} className="flex gap-8 group/item">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-none mt-1.5 transition-all duration-500 group-hover/item:scale-150 shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]",
                    log.type === 'SUCCESS' ? "bg-green-500/60" : "bg-editorial-accent/60"
                  )} />
                  <div className="w-px flex-1 bg-editorial-border/30 mt-3" />
                </div>
                <div className="pb-10 border-b border-editorial-border/10 w-full group-hover/item:border-editorial-accent/20 transition-all">
                  <p className="font-mono text-[8px] font-black text-editorial-text/20 uppercase tracking-[0.3em] mb-3">{log.date} — {log.city}</p>
                  <p className="font-sans text-[11px] font-medium text-editorial-text/60 italic group-hover/item:text-editorial-text transition-colors leading-relaxed tracking-tight">{log.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Categories & Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="stat-card border border-editorial-border bg-editorial-card p-12 lg:col-span-2 shadow-soft group"
        >
          <div className="flex justify-between items-start mb-16 px-4">
            <div>
              <h3 className="serif text-6xl italic text-editorial-text leading-none mb-4">Portfolio <br /><span className="text-editorial-text/10 italic">Matrix.</span></h3>
              <p className="font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-text/20 italic">FY_24_26.DISTRIBUTION_QUERY</p>
            </div>
            <div className="flex gap-1 overflow-hidden h-1.5">
               <div className="w-8 h-full bg-editorial-accent/20 animate-shimmer" />
               <div className="w-4 h-full bg-editorial-accent/10" />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-16 items-center px-4">
            <div className="h-72 relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="text-center">
                    <p className="font-mono text-[10px] font-black text-editorial-text/10 uppercase tracking-[0.2em] mb-1">DATA_TOTAL</p>
                    <p className="serif text-3xl italic text-editorial-accent font-light">100%</p>
                 </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={10}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-8">
              {categoryData.map((item, i) => (
                <div key={i} className="flex justify-between items-center group/item border-b border-editorial-border/30 pb-4">
                  <div className="flex items-center gap-6">
                    <div className="w-1.5 h-6 bg-editorial-text/10 group-hover/item:bg-editorial-accent transition-all duration-500" style={{ backgroundColor: selectedCategory === item.name ? item.color : undefined }} />
                    <span className="font-mono text-[10px] font-black uppercase tracking-[0.4em] text-editorial-text/40 group-hover/item:text-editorial-text transition-colors">{item.name}</span>
                  </div>
                  <span className="font-mono text-xl font-black italic text-editorial-text/20 group-hover/item:text-editorial-accent transition-colors">[{item.value}%]</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Client Snapshot */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="stat-card border border-editorial-border bg-editorial-card p-12 shadow-soft group"
        >
          <div className="flex justify-between items-center mb-16 border-b border-editorial-border pb-8">
            <h3 className="serif text-4xl italic text-editorial-text">Strategic Partners.</h3>
            <div className="flex gap-3">
               <div className="w-1.5 h-1.5 bg-editorial-accent animate-pulse" />
               <div className="w-1.5 h-1.5 bg-editorial-text/10" />
               <div className="w-1.5 h-1.5 bg-editorial-text/10" />
            </div>
          </div>
          <div className="space-y-6">
            {topClients.map((client, i) => (
              <div key={i} className="flex justify-between items-center p-8 border border-editorial-border bg-editorial-text/[0.01] hover:bg-editorial-text/[0.03] hover:border-editorial-accent/30 transition-all group/item shadow-inner relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-editorial-accent/10 group-hover/item:w-2 transition-all" />
                <div className="space-y-2 relative z-10">
                   <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-editorial-text transition-colors">{client.name}</p>
                   <p className="font-mono text-[8px] font-bold text-editorial-text/30 uppercase tracking-[0.4em]">{client.events} ENGAGEMENTS_ACTIVE</p>
                </div>
                <div className="text-right relative z-10">
                   <p className="font-mono text-xl font-black italic text-editorial-accent/60 group-hover/item:text-editorial-accent transition-colors">{client.value}</p>
                   <p className="font-mono text-[7px] font-black text-green-500/40 uppercase tracking-[0.5em] mt-1 shadow-glow-green">VERIFIED_PARTNER</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mini Management View */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="stat-card border border-editorial-border overflow-hidden shadow-soft group"
        >
          <div className="px-12 py-10 border-b border-editorial-border flex justify-between items-center bg-editorial-text/[0.01]">
            <h3 className="serif text-4xl font-light italic text-editorial-text leading-none">Active <br /><span className="text-editorial-text/20">Mandates.</span></h3>
            <Link to="/dashboard/events" className="group flex items-center gap-4 font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-text/20 hover:text-editorial-accent transition-all">
               FULL_CATALOG
               <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="p-10 space-y-6">
            {events.length > 0 ? (
              <div className="space-y-6">
                {events.slice(0, 3).map(event => (
                  <div 
                    key={event.id} 
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="flex justify-between items-center p-8 border border-editorial-border hover:border-editorial-accent transition-all cursor-pointer group/item bg-editorial-bg shadow-inner relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-editorial-accent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-8">
                       <div className="w-14 h-14 border border-editorial-border overflow-hidden grayscale group-hover/item:grayscale-0 transition-all duration-700 shadow-soft">
                          <img src={event.imageUrl} className="w-full h-full object-cover scale-110 group-hover/item:scale-100 transition-transform duration-700" />
                       </div>
                       <div>
                        <p className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-editorial-text transition-colors group-hover/item:text-editorial-accent italic truncate max-w-[200px]">{event.title}</p>
                        <p className="font-mono text-[8px] text-editorial-accent/50 uppercase tracking-[0.4em] mt-2 font-black italic">{formatDate(event.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[9px] font-black text-editorial-text/20 uppercase tracking-[0.3em] mb-3 group-hover/item:text-editorial-text transition-colors">
                        LOAD: <span className="text-editorial-text">{((event.totalCapacity - event.remainingCapacity) / event.totalCapacity * 100).toFixed(0)}%</span>
                      </p>
                      <div className="w-32 h-1 bg-editorial-text/[0.05] rounded-none overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-editorial-accent transition-all duration-1000 shadow-glow-accent" 
                          style={{ width: `${((event.totalCapacity - event.remainingCapacity) / event.totalCapacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 text-center border border-dashed border-editorial-border bg-editorial-bg shadow-inner">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-editorial-text/10 italic leading-loose">AWAITING_NEW_CREATIVE_MANDATES</p>
                <div className="mt-8 flex justify-center gap-4 opacity-10">
                   <div className="w-1 h-1 bg-editorial-text" />
                   <div className="w-1 h-1 bg-editorial-text" />
                   <div className="w-1 h-1 bg-editorial-text" />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function CollaborationWorkspace({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'roster' | 'tasks'>('tasks');
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (!selectedEventId) {
      setTasks([]);
      setCollaborators([]);
      return;
    }

    const tasksRef = collection(db, 'events', selectedEventId, 'tasks');
    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${selectedEventId}/tasks`);
    });

    const collaboratorsRef = collection(db, 'events', selectedEventId, 'collaborators');
    const unsubscribeCollaborators = onSnapshot(collaboratorsRef, (snapshot) => {
      setCollaborators(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collaborator)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${selectedEventId}/collaborators`);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeCollaborators();
    };
  }, [selectedEventId]);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto"
    >
      <header className="flex flex-col lg:flex-row justify-between items-baseline gap-12 mb-20 border-b border-editorial-border pb-16 relative">
        <div className="absolute -top-12 -left-4 bg-editorial-accent/10 px-4 py-2 border border-editorial-accent/20 backdrop-blur-md">
           <span className="text-[8px] font-bold uppercase tracking-[0.4em] text-editorial-accent">Multi-User Sync Active</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-editorial-accent mb-6 mt-4 opacity-70 italic">Collaboration Center</p>
          <h1 className="serif text-7xl lg:text-8xl font-light tracking-tighter italic text-editorial-text leading-none">Shared <br /><span className="text-editorial-text/20 italic">Architectures.</span></h1>
        </div>
        <div className="flex flex-col gap-6 w-full lg:w-[400px]">
           <div className="space-y-3">
              <label className="text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 ml-1">Event Domain</label>
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-editorial-bg border border-editorial-border px-6 py-5 text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/80 focus:outline-none focus:border-editorial-accent transition-all appearance-none cursor-pointer hover:bg-editorial-text/[0.02]"
              >
                <option value="" className="bg-editorial-bg">Acknowledge Active Event...</option>
                {events.map(e => (
                  <option key={e.id} value={e.id} className="bg-editorial-bg">{e.title}</option>
                ))}
              </select>
            </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('tasks')}
              className={cn(
                "flex-1 px-8 py-5 text-[9px] font-black uppercase tracking-[0.4em] transition-all cursor-pointer relative overflow-hidden group",
                activeTab === 'tasks' ? "bg-editorial-text text-editorial-bg" : "text-editorial-text/40 hover:text-editorial-text border border-editorial-border"
              )}
            >
              <span className="relative z-10">Operations Board</span>
              {activeTab === 'tasks' && <div className="absolute inset-x-0 bottom-0 h-1 bg-editorial-accent" />}
            </button>
            <button 
              onClick={() => setActiveTab('roster')}
              className={cn(
                "flex-1 px-8 py-5 text-[9px] font-black uppercase tracking-[0.4em] transition-all cursor-pointer relative overflow-hidden group",
                activeTab === 'roster' ? "bg-editorial-text text-editorial-bg" : "text-editorial-text/40 hover:text-editorial-text border border-editorial-border"
              )}
            >
              <span className="relative z-10">Curator Roster</span>
              {activeTab === 'roster' && <div className="absolute inset-x-0 bottom-0 h-1 bg-editorial-accent" />}
            </button>
          </div>
        </div>
      </header>

      {!selectedEventId ? (
        <div className="stat-card border border-editorial-border p-32 text-center border-dashed bg-editorial-text/[0.01]">
            <p className="text-[11px] font-bold uppercase tracking-[0.6em] text-editorial-text/20 italic max-w-sm mx-auto leading-loose">Select a strategic mandate to coordinate operational objectives and curator assignments.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${selectedEventId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: "circOut" }}
          >
            {activeTab === 'tasks' ? (
              <TaskBoard eventId={selectedEventId} tasks={tasks} />
            ) : (
              <CollaboratorRoster eventId={selectedEventId} collaborators={collaborators} />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

function TaskBoard({ eventId, tasks }: { eventId: string, tasks: Task[] }) {
  const addTask = async (status: string) => {
    const title = prompt("Task Narrative:");
    if (!title) return;
    try {
      await addDoc(collection(db, 'events', eventId, 'tasks'), {
        title,
        status,
        role: "Logistics",
        assignedTo: "Director",
        priority: "Medium",
        createdAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `events/${eventId}/tasks`);
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={{
        show: {
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
      className="grid lg:grid-cols-3 gap-8"
    >
      <TaskColumn title="To Do" status="todo" tasks={tasks.filter(t => t.status === 'todo')} onAdd={() => addTask('todo')} />
      <TaskColumn title="In Progress" status="in_progress" tasks={tasks.filter(t => t.status === 'in_progress')} onAdd={() => addTask('in_progress')} />
      <TaskColumn title="Accomplished" status="done" tasks={tasks.filter(t => t.status === 'done')} onAdd={() => addTask('done')} />
    </motion.div>
  );
}

function TaskColumn({ title, status, tasks, onAdd }: { title: string, status: string, tasks: Task[], onAdd: () => void }) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.8 } }
      }}
      className="flex flex-col gap-8"
    >
      <div className="flex justify-between items-baseline border-b border-editorial-border pb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/30">{title}</h4>
        <span className="text-[10px] font-bold text-editorial-accent opacity-40">{tasks.length}</span>
      </div>
      <motion.div 
        initial="hidden"
        animate="show"
        variants={{
          show: {
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
        className="space-y-6"
      >
        {tasks.map((task: any) => (
          <div key={task.id}>
            <TaskCard title={task.title} role={task.role} assignee={task.assignedTo} priority={task.priority} />
          </div>
        ))}
      </motion.div>
      <button 
        onClick={onAdd}
        className="w-full py-4 border border-dashed border-editorial-border text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 hover:text-editorial-text hover:border-editorial-accent/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus size={14} /> Append Objective
      </button>
    </motion.div>
  );
}

function TaskCard({ title, role, assignee, priority }: { title: string, role: string, assignee: string, priority: string }) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        show: { opacity: 1, scale: 1 }
      }}
      whileHover={{ y: -5, borderColor: 'var(--accent)' }}
      className="stat-card border border-editorial-border p-8 group hover:border-editorial-accent/30 transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-6">
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-accent">{role}</span>
        <span className={cn(
          "text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded border",
          priority === 'High' ? "text-red-400 border-red-400/20 bg-red-400/5" : "text-editorial-text/20 border-editorial-border"
        )}>
          {priority}
        </span>
      </div>
      <h5 className="serif text-xl text-editorial-text group-hover:text-editorial-accent transition-colors mb-6 italic">{title}</h5>
      <div className="flex justify-between items-center pt-6 border-t border-editorial-border">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-editorial-text/5 border border-editorial-border overflow-hidden text-[8px] flex items-center justify-center font-bold text-editorial-text/40">
            {assignee.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-editorial-text/40 italic">{assignee}</span>
        </div>
        <button className="text-editorial-text/10 group-hover:text-editorial-text transition-colors">
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function CollaboratorRoster({ eventId, collaborators }: { eventId: string, collaborators: Collaborator[] }) {
  const addCollaborator = async () => {
    const name = prompt("Curator Name:");
    const email = prompt("Curator Email:");
    if (!name || !email) return;
    try {
      await addDoc(collection(db, 'events', eventId, 'collaborators'), {
        name,
        email,
        role: "Associate",
        status: "Active",
        joinedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `events/${eventId}/collaborators`);
    }
  };

  return (
    <div className="stat-card border border-editorial-border overflow-hidden">
      <div className="px-12 py-8 border-b border-editorial-border flex justify-between items-center">
        <h3 className="serif text-2xl font-light italic text-editorial-text">Registry of Curators</h3>
        <button 
          onClick={addCollaborator}
          className="bg-editorial-accent text-editorial-bg px-6 py-3 font-bold uppercase tracking-[0.3em] text-[9px] hover:bg-editorial-text hover:text-editorial-bg transition-colors cursor-pointer"
        >
          Invite Colleague
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-editorial-text/[0.02] text-[9px] font-bold uppercase tracking-[0.4em] text-editorial-text/20">
              <th className="px-12 py-6">Curator</th>
              <th className="px-12 py-6">Specialization</th>
              <th className="px-12 py-6">Engagement</th>
              <th className="px-12 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-editorial-border">
            {collaborators.length > 0 ? (
              collaborators.map((c: any) => (
                <Fragment key={c.id}>
                  <RosterRow name={c.name} role={c.role} email={c.email} status={c.status} avatar={c.name.split(' ').map((n: string) => n[0]).join('')} />
                </Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-12 py-20 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/10 italic">
                  Registry is currently empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckInSystem({ user, events }: { user: User | null, events: Event[] }) {
  const [ticketId, setTicketId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !ticketId) return;

    setLoading(true);
    setError(null);
    setLastChecked(null);

    try {
      const regsRef = collection(db, 'events', selectedEventId, 'registrations');
      const q = query(regsRef, where('ticketId', '==', ticketId.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Invalid Token. Patron not found in registry.");
      }

      const regDoc = querySnapshot.docs[0];
      const regData = regDoc.data();

      if (regData.checkedIn) {
        setLastChecked({ ...regData, alreadyChecked: true });
        return;
      }

      await updateDoc(doc(db, 'events', selectedEventId, 'registrations', regDoc.id), {
        checkedIn: true,
        checkedInAt: serverTimestamp()
      });

      setLastChecked({ ...regData, checkedIn: true, firstTime: true });
      setTicketId("");
    } catch (err: any) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-32"
    >
      <header className="border-b border-editorial-border pb-16 relative">
        <div className="absolute -top-12 -left-4 bg-editorial-accent/10 px-4 py-2 border border-editorial-accent/20 backdrop-blur-md">
           <span className="text-[8px] font-bold uppercase tracking-[0.4em] text-editorial-accent">Reception Protocol Active</span>
        </div>
        <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-editorial-accent mb-6 mt-4 opacity-70 italic border-l-2 border-editorial-accent pl-6">Core Verification Module</p>
        <h1 className="serif text-8xl lg:text-9xl font-light tracking-tighter italic text-editorial-text leading-none">Patron <br /><span className="text-editorial-text/5 italic">Reception.</span></h1>
      </header>

      <div className="grid lg:grid-cols-12 gap-16">
        <div className="lg:col-span-5">
           <div className="bg-editorial-text/[0.02] p-1 border border-editorial-border shadow-inner">
            <form onSubmit={handleCheckIn} className="stat-card border border-editorial-border p-12 space-y-12 bg-editorial-bg">
              <div className="space-y-4">
                <label className="text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 italic ml-1">Archive Focal Point</label>
                <select 
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  required
                  className="w-full bg-editorial-bg border border-editorial-border px-6 py-5 focus:outline-none focus:border-editorial-accent transition-all text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text appearance-none cursor-pointer"
                >
                  <option value="" className="bg-editorial-bg italic">Acknowledge Collection...</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id} className="bg-editorial-bg italic">{e.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 italic ml-1">Access Token Hash</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value)}
                    required
                    placeholder="TIC-XXXXXXXXX"
                    className="w-full bg-editorial-text/[0.01] border border-editorial-border px-6 py-8 focus:outline-none focus:border-editorial-accent transition-all serif text-3xl italic text-editorial-text placeholder:text-editorial-text/5 tracking-widest uppercase"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
                     <Search size={20} strokeWidth={1} />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || !selectedEventId}
                className="w-full bg-editorial-text text-editorial-bg py-6 font-bold uppercase tracking-[0.5em] text-[10px] hover:bg-editorial-accent transition-all disabled:opacity-20 shadow-2xl cursor-pointer relative group overflow-hidden"
              >
                <span className="relative z-10">{loading ? 'AUTHENTICATING SIGNAL...' : 'VERIFY PATRON ACCESS'}</span>
                <div className="absolute inset-0 bg-editorial-accent -translate-x-full group-hover:translate-x-0 transition-transform duration-700 opacity-20" />
              </button>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-6 bg-red-500/[0.03] border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-[0.3em] italic"
                >
                  ERROR: {error}
                </motion.div>
              )}
            </form>
           </div>
           
           <div className="mt-12 p-8 border border-editorial-border bg-editorial-text/[0.01]">
              <p className="text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/20 mb-6">Device Status</p>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[8px] font-bold text-editorial-text/40 uppercase tracking-widest">Network Secure</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-editorial-accent rounded-full" />
                    <span className="text-[8px] font-bold text-editorial-text/40 uppercase tracking-widest">Scanner Ready</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-7">
          <div className="h-full bg-editorial-text/[0.01] border border-editorial-border relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                  style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dust.png")' }} />

            <AnimatePresence mode="wait">
              {lastChecked ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="relative z-10 w-full max-w-lg p-12 text-center"
                >
                  <div className={cn(
                    "w-32 h-32 rounded-full border flex items-center justify-center mx-auto mb-12 shadow-[0_0_50px_rgba(0,0,0,0.05)]",
                    lastChecked.alreadyChecked ? "border-red-500/40 text-red-500/40" : "border-editorial-accent text-editorial-accent shadow-editorial-accent/20"
                  )}>
                    {lastChecked.alreadyChecked ? <X size={48} strokeWidth={1} /> : <div className="animate-pulse"><Users size={48} strokeWidth={1} /></div>}
                  </div>
                  
                  <div className="space-y-8">
                     <p className="text-[10px] font-black uppercase tracking-[0.6em] text-editorial-accent/60 mb-4">{lastChecked.alreadyChecked ? 'PREVIOUSLY ACKNOWLEDGED' : 'PATRON IDENTIFIED'}</p>
                     <h2 className="serif text-5xl lg:text-6xl italic text-editorial-text italic leading-tight tracking-tighter uppercase">
                        {lastChecked.fullName || lastChecked.attendeeName}
                     </h2>
                     <div className="h-px w-24 bg-editorial-border mx-auto" />
                     <p className="serif text-xl text-editorial-text/40 italic">Registry Code: {lastChecked.ticketId}</p>
                     
                     <div className="pt-12 grid grid-cols-2 gap-8 text-left">
                        <div className="p-6 border border-editorial-border bg-editorial-bg">
                           <p className="text-[8px] font-black uppercase tracking-[0.4em] text-editorial-text/20 mb-2">Category</p>
                           <p className="text-[10px] font-bold text-editorial-text uppercase tracking-widest">{lastChecked.ticketType || 'VVIP'}</p>
                        </div>
                        <div className="p-6 border border-editorial-border bg-editorial-bg">
                           <p className="text-[8px] font-black uppercase tracking-[0.4em] text-editorial-text/20 mb-2">Signal Timestamp</p>
                           <p className="text-[10px] font-bold text-editorial-text uppercase tracking-widest">{new Date().toLocaleTimeString()}</p>
                        </div>
                     </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                   key="idle"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="text-center p-12"
                >
                   <div className="mb-12 opacity-5">
                      <Activity size={120} strokeWidth={0.5} />
                   </div>
                   <p className="serif text-2xl lg:text-3xl italic text-editorial-text/10 max-w-md mx-auto leading-relaxed">
                      Standing by for patron authentication protocol...
                   </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RosterRow({ name, role, email, status, avatar }: { name: string, role: string, email: string, status: string, avatar: string }) {
  return (
    <tr className="hover:bg-editorial-text/[0.01] transition-colors group">
      <td className="px-12 py-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-editorial-accent/10 border border-editorial-accent/20 flex items-center justify-center text-editorial-accent font-bold text-xs">
            {avatar}
          </div>
          <div>
            <p className="text-sm font-semibold italic text-editorial-text/80">{name}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-editorial-text/20">{email}</p>
          </div>
        </div>
      </td>
      <td className="px-12 py-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-editorial-accent italic">{role}</p>
      </td>
      <td className="px-12 py-8">
        <span className={cn(
          "text-[8px] font-bold uppercase tracking-[0.3em] px-2 py-1 border",
          status === 'Active' ? "text-green-500 border-green-500/20" : "text-editorial-text/20 border-editorial-border"
        )}>
          {status}
        </span>
      </td>
      <td className="px-12 py-8 text-right">
        <button className="text-[9px] font-bold uppercase tracking-[0.3em] text-editorial-text/20 hover:text-editorial-text transition-colors border-b border-transparent hover:border-editorial-text pb-1 italic cursor-pointer">
          Modify Access
        </button>
      </td>
    </tr>
  );
}

function DashboardLink({ to, icon, label, active = false, badge }: { to: string, icon?: any, label: string, active?: boolean, badge?: string | number }) {
  return (
    <Link 
      to={to} 
      className={cn(
        "flex items-center justify-between px-4 py-3 text-[10px] font-bold transition-all uppercase tracking-[0.4em] relative group/link",
        active ? "text-editorial-accent" : "text-editorial-text/40 hover:text-editorial-text italic"
      )}
    >
      <div className="flex items-center gap-4">
        {active && (
          <motion.div 
            layoutId="dashboard-active"
            className="absolute left-[-10px] w-0.5 h-6 bg-editorial-accent" 
          />
        )}
        {icon}
        {label}
      </div>
      {badge && (
        <span className="text-[8px] font-bold tracking-widest text-editorial-accent/60 group-hover/link:text-editorial-accent transition-colors bg-editorial-accent/5 px-2 py-0.5 border border-editorial-accent/10 italic">
          {badge}
        </span>
      )}
    </Link>
  );
}

function StatCard({ label, numValue, prefix = "", suffix = "", delta, sparkData, isGrowth = true, valueClassName }: { label: string, numValue: number, prefix?: string, suffix?: string, delta?: string, sparkData?: SparkPoint[], isGrowth?: boolean, valueClassName?: string }) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6 } }
      }}
      whileHover={{ 
        y: -4, 
        borderColor: 'var(--editorial-accent)',
        backgroundColor: 'rgba(var(--accent-rgb), 0.04)'
      }}
      className="stat-card p-6 lg:p-8 border border-editorial-border flex flex-col justify-between aspect-square lg:aspect-auto min-h-[160px] group transition-all duration-700 relative bg-editorial-card/40 overflow-hidden shadow-soft"
    >
      {/* Subtle Depth Overlay */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none group-hover:opacity-[0.03] transition-opacity" 
           style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dust.png")' }} />

      <div className="relative z-10 w-full overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
           <div className="w-1 h-3 bg-editorial-accent/20 group-hover:bg-editorial-accent transition-colors" />
           <p className="font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-text/20 group-hover:text-editorial-accent/60 transition-colors truncate">{label}</p>
        </div>
        <p className={cn(
          "font-mono font-black tracking-tighter text-editorial-text group-hover:text-editorial-accent transition-all duration-500 whitespace-nowrap",
          valueClassName || "text-4xl lg:text-5xl"
        )}>
          <CountUp end={numValue} prefix={prefix} suffix={suffix} />
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-1/2 opacity-[0.08] pointer-events-none overflow-hidden group-hover:opacity-20 transition-opacity">
        {sparkData && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={1} fillOpacity={0} fill="transparent" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {delta && (
        <div className="pt-8 flex items-center justify-between border-t border-editorial-border/30 mt-8 relative z-10">
          <span className={cn(
            "font-mono text-[8px] font-black uppercase tracking-[0.3em] flex items-center gap-2",
            isGrowth ? "text-green-500/60" : "text-editorial-text/30"
          )}>
            {isGrowth ? <TrendingUp size={10} strokeWidth={2.5} /> : <div className="w-2 h-2 border border-editorial-text/20" />}
            {delta} <span className="opacity-40">/ BASELINE</span>
          </span>
          <ArrowRight size={14} strokeWidth={1} className={cn("-rotate-45 opacity-20 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform group-hover:opacity-100", isGrowth && "text-green-500/40 group-hover:text-green-500")} />
        </div>
      )}
    </motion.div>
  );
}

function TableRow({ name, event, date, amount, status }: { name: string, event: string, date: string, amount: string, status: string }) {
  return (
    <motion.tr 
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="hover:bg-editorial-text/[0.02] transition-all group border-b border-editorial-border/30"
    >
      <td className="px-12 py-7">
        <p className="serif text-sm italic text-editorial-text/80 group-hover:text-editorial-accent transition-colors">{name}</p>
      </td>
      <td className="px-12 py-7">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-editorial-text/30 italic">{event}</p>
      </td>
      <td className="px-12 py-7">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-editorial-text/20">{date}</p>
      </td>
      <td className="px-12 py-7">
        <p className="font-mono text-xs font-black text-editorial-accent italic">{amount}</p>
      </td>
      <td className="px-12 py-7 text-right">
        <span className={cn(
          "font-mono text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1.5 border backdrop-blur-md transition-all",
          status === 'Settled' ? "text-green-500 border-green-500/20 bg-green-500/5 group-hover:bg-green-500/10" : "text-editorial-accent border-editorial-accent/20 bg-editorial-accent/5 group-hover:bg-editorial-accent/10"
        )}>
          {status}
        </span>
      </td>
    </motion.tr>
  );
}

function ProfilePage({ user, profile, events }: { user: User | null; profile: UserProfile | null; events: Event[] }) {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio || "");
  const [savingBio, setSavingBio] = useState(false);

  useEffect(() => {
    if (profile?.bio) {
      setBioText(profile.bio);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, "global_registrations"), where("attendeeId", "==", user.uid), orderBy("purchaseDate", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRegistrations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSaveBio = async () => {
    if (!user) return;
    setSavingBio(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { bio: bioText });
      setIsEditingBio(false);
    } catch (error) {
      console.error("Error saving bio:", error);
    } finally {
      setSavingBio(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-editorial-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="pt-48 pb-24 px-6 max-w-7xl mx-auto min-h-screen relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
         <div className="font-mono text-[120px] font-black uppercase tracking-tighter rotate-12">DATA_ARCHIVE</div>
      </div>

      <header className="mb-24 border-b border-editorial-border/30 pb-20 relative z-10">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-px bg-editorial-accent/30" />
           <p className="font-mono text-[9px] uppercase tracking-[0.5em] font-black text-editorial-accent italic">USER ARCHIVE</p>
        </div>
        <h1 className="serif text-8xl lg:text-[10rem] font-light tracking-tighter italic text-editorial-text leading-[0.85] mb-4">Your <br /><span className="text-editorial-text/5 italic">Registry.</span></h1>
        <p className="font-mono text-[9px] font-black text-editorial-text/20 uppercase tracking-[0.4em] ml-2 italic">AUTHENTICATED SESSION NOMINAL</p>
      </header>

      <div className="grid lg:grid-cols-12 gap-16 relative">
        <button 
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="hidden lg:flex items-center gap-4 absolute -left-12 top-0 z-20 font-mono text-[9px] font-black uppercase tracking-[0.5em] text-editorial-text/10 hover:text-editorial-accent transition-all -rotate-90 origin-left"
        >
          {sidebarVisible ? <ChevronLeft size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
          {sidebarVisible ? "MINIMIZE INFO" : "EXPAND INFO"}
        </button>

        <aside className={cn(
          "space-y-12 transition-all duration-700 overflow-hidden relative z-10",
          sidebarVisible ? "lg:col-span-3 opacity-100" : "lg:col-span-0 opacity-0 w-0 pointer-events-none"
        )}>
          <div className="p-8 border border-editorial-border/40 bg-editorial-bg text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-editorial-accent/20 group-hover:bg-editorial-accent transition-colors" />
            
            {user?.photoURL ? (
              <div className="relative inline-block mb-10 group/avatar">
                <img src={user.photoURL} alt="" className="w-24 h-24 rounded-none mx-auto border border-editorial-border/60 grayscale group-hover/avatar:grayscale-0 transition-all duration-700 relative z-10" />
                <div className="absolute -inset-2 border border-editorial-accent/10 animate-pulse pointer-events-none" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-none mx-auto mb-10 border border-editorial-border bg-editorial-text/[0.02] flex items-center justify-center relative overflow-hidden group/avatar">
                 <UserCircle2 size={48} strokeWidth={1} className="text-editorial-text/10 relative z-10 group-hover/avatar:scale-110 transition-transform duration-700" />
                 <div className="absolute inset-0 bg-editorial-accent/5 opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
              </div>
            )}
            
            <h3 className="serif text-3xl text-editorial-text italic leading-tight group-hover:text-editorial-accent transition-colors mb-2">{user?.displayName || "UNNAMED ENTITY"}</h3>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.3em] text-editorial-text/20 italic mb-8">{user?.email}</p>
            
            <div className="text-left mb-10">
              <div className="flex justify-between items-center mb-4">
                <p className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-accent/60 italic">PERSONAL_BIO</p>
                {!isEditingBio ? (
                  <button 
                    onClick={() => setIsEditingBio(true)}
                    className="text-[8px] font-bold uppercase tracking-widest text-editorial-text/20 hover:text-editorial-accent transition-colors cursor-pointer"
                  >
                    EDIT_FIELD
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsEditingBio(false)}
                      className="text-[8px] font-bold uppercase tracking-widest text-red-500/40 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button 
                      onClick={handleSaveBio}
                      disabled={savingBio}
                      className="text-[8px] font-bold uppercase tracking-widest text-green-500/40 hover:text-green-500 transition-colors cursor-pointer disabled:opacity-30"
                    >
                      {savingBio ? "SAVING..." : "COMMIT"}
                    </button>
                  </div>
                )}
              </div>
              
              {isEditingBio ? (
                <textarea 
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  className="w-full bg-editorial-text/[0.02] border border-editorial-border p-4 font-sans text-xs italic text-editorial-text/60 focus:outline-none focus:border-editorial-accent transition-all resize-none h-32"
                  placeholder="Insert biographical data..."
                />
              ) : (
                <p className="font-sans text-xs italic text-editorial-text/40 leading-relaxed min-h-[4rem]">
                  {profile?.bio || "No biographical data archived for this entity."}
                </p>
              )}
            </div>
            
            <div className="mt-12 pt-10 border-t border-editorial-border/20 space-y-5">
               <div className="flex justify-between items-center font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-text/40 italic">
                  <span className="flex items-center gap-2 italic opacity-40">RANK_AUTHORITY</span>
                  <span className="text-editorial-accent/80 bg-editorial-accent/5 px-4 py-1">{profile?.role === 'organizer' ? 'DIRECTORATE' : 'CITIZEN_PATRON'}</span>
               </div>
               
               {profile?.role !== 'organizer' && (
                 <button 
                  onClick={async () => {
                    if (!user) return;
                    await setDoc(doc(db, 'users', user.uid), { role: 'organizer' }, { merge: true });
                  }}
                  className="w-full bg-editorial-text text-editorial-bg py-5 font-mono text-[9px] font-black uppercase tracking-[0.6em] hover:bg-editorial-accent transition-all duration-500 shadow-2xl cursor-pointer relative group overflow-hidden"
                 >
                   <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-0 group-hover:w-full transition-all duration-700" />
                   UPGRADE STATUS
                 </button>
               )}
            </div>
          </div>

          <div className="p-8 border border-editorial-border/30 space-y-10 bg-editorial-bg shadow-sm">
            <h4 className="font-mono text-[9px] font-black uppercase tracking-[0.5em] text-editorial-accent italic flex items-center justify-between">
              ACTIVITY LOG
              <Activity size={10} className="animate-pulse" />
            </h4>
            <div className="space-y-8">
              {registrations.map((reg) => (
                <div key={reg.id} className="p-5 border-l border-editorial-accent/30 bg-editorial-text/[0.01] hover:bg-editorial-text/[0.03] hover:border-editorial-accent transition-all group/item shadow-sm">
                  <p className="font-mono text-[7px] font-black uppercase tracking-[0.4em] text-editorial-text/20 mb-3 group-hover/item:text-editorial-accent/40 transition-colors italic">ACCESS GRANTED</p>
                  <p className="font-sans text-[11px] text-editorial-text/60 italic group-hover/item:text-editorial-text transition-colors leading-relaxed tracking-tight">Entry authorized for ID-{reg.eventId.substring(0, 8)}</p>
                  <p className="font-mono text-[8px] text-editorial-text/10 mt-3">{new Date(reg.purchaseDate?.seconds * 1000).toLocaleTimeString()} // {new Date(reg.purchaseDate?.seconds * 1000).toLocaleDateString()}</p>
                </div>
              ))}
              {registrations.length === 0 && (
                <div className="py-12 text-center opacity-10">
                   <p className="font-mono text-[10px] font-black uppercase tracking-[0.5em] italic">NULL_LOG_PACKS</p>
                   <div className="mt-4 flex justify-center gap-2">
                      <div className="w-1 h-1 bg-editorial-text" />
                      <div className="w-1 h-1 bg-editorial-text" />
                   </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className={cn(
          "transition-all duration-700 relative z-10",
          sidebarVisible ? "lg:col-span-9" : "lg:col-span-12"
        )}>
          <div className="space-y-24">
            <section className="space-y-12">
              <div className="flex items-center gap-6 mb-8">
                 <div className="w-8 h-px bg-editorial-accent/30" />
                 <h2 className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent italic">UPCOMING_ENGAGEMENTS</h2>
              </div>
              
              <div className="space-y-12">
                {registrations.filter(reg => {
                  const event = events.find(e => e.id === reg.eventId);
                  return event && new Date(event.date) >= new Date();
                }).length > 0 ? (
                  registrations
                    .filter(reg => {
                      const event = events.find(e => e.id === reg.eventId);
                      return event && new Date(event.date) >= new Date();
                    })
                    .map((reg) => {
                      const event = events.find(e => e.id === reg.eventId);
                      return (
                        <motion.div 
                          key={reg.id}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          className="stat-card border border-editorial-border p-12 hover:border-editorial-accent/30 hover:bg-editorial-text/[0.01] transition-all group overflow-hidden relative shadow-2xl"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-editorial-accent opacity-20 group-hover:opacity-100 transition-opacity" />
                          <div className="flex flex-col md:flex-row gap-16 items-center">
                            <div className="flex-1 space-y-10">
                              <div>
                                <p className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-editorial-accent mb-6 italic group-hover:tracking-[0.7em] transition-all">{event?.category || "CATALOG_ENTRY"}</p>
                                <h4 className="serif text-5xl text-editorial-text italic uppercase tracking-tighter leading-tight">{event?.title || "ARCHIVED_COLLECTION"}</h4>
                              </div>
                              <div className="grid grid-cols-2 gap-12 font-mono text-[9px] font-black uppercase tracking-[0.3em] italic text-editorial-text/30">
                                <div className="space-y-3">
                                  <p className="text-editorial-text/10 not-italic tracking-[0.5em]">TEMPORAL_LOCK</p>
                                  <p className="text-editorial-text/60">{event ? formatDate(event.date) : "N/A"}</p>
                                </div>
                                <div className="space-y-3">
                                  <p className="text-editorial-text/10 not-italic tracking-[0.5em]">SPATIAL_COORDS</p>
                                  <p className="text-editorial-text/60 truncate max-w-[150px]">{event?.location || "N/A"}</p>
                                </div>
                                <div className="col-span-2 pt-8 border-t border-editorial-border/30">
                                   <p className="text-editorial-text/10 mb-4 not-italic tracking-[0.6em]">INTERNAL_DNA_SIGNATURE</p>
                                   <p className="text-editorial-accent/40 font-mono tracking-[0.4em] select-all cursor-crosshair hover:text-editorial-accent transition-colors"><span className="text-[31px]">{reg.ticketId}</span></p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="w-full md:w-max flex flex-col items-center gap-8 p-10 border border-editorial-border bg-editorial-bg shadow-inner relative group/qr">
                              <div className="absolute inset-0 bg-editorial-accent/5 opacity-0 group-hover/qr:opacity-100 transition-opacity" />
                              <div className="bg-editorial-text p-6 rounded-none shadow-2xl relative z-10 transition-transform group-hover/qr:scale-105 duration-500">
                                <QRCodeCanvas 
                                  value={JSON.stringify({ 
                                    ticketId: reg.ticketId, 
                                    eventId: reg.eventId, 
                                    attendeeId: user?.uid 
                                  })} 
                                  size={160}
                                  level="H"
                                  includeMargin={false}
                                  bgColor="#FFFFFF"
                                  fgColor="#000000"
                                />
                              </div>
                              <div className="text-center relative z-10">
                                <div className="inline-block bg-editorial-accent text-editorial-bg px-6 py-1.5 mb-3">
                                   <p className="font-mono text-[9px] font-black uppercase tracking-[0.5em] italic">VALIDATED</p>
                                </div>
                                <p className="font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-text/20 italic">BIOMETRIC_SCAN_REQUIRED</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="absolute -bottom-24 -right-24 opacity-[0.015] group-hover:opacity-[0.05] transition-all duration-1000 pointer-events-none group-hover:-rotate-6">
                             <Ticket size={400} className="rotate-12 text-editorial-text" />
                          </div>
                        </motion.div>
                      );
                    })
                ) : (
                  <div className="stat-card border border-dashed border-editorial-border py-20 text-center bg-editorial-text/[0.01] shadow-inner">
                     <p className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-editorial-text/10 italic">NO_UPCOMING_ENGAGEMENTS</p>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-12">
              <div className="flex items-center gap-6 mb-8">
                 <div className="w-8 h-px bg-editorial-accent/30" />
                 <h2 className="font-mono text-[10px] uppercase tracking-[0.6em] font-black text-editorial-accent italic">PAST_ARCHIVE_ATTENDANCE</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                {registrations.filter(reg => {
                  const event = events.find(e => e.id === reg.eventId);
                  return event && new Date(event.date) < new Date();
                }).length > 0 ? (
                  registrations
                    .filter(reg => {
                      const event = events.find(e => e.id === reg.eventId);
                      return event && new Date(event.date) < new Date();
                    })
                    .map((reg) => {
                      const event = events.find(e => e.id === reg.eventId);
                      return (
                        <motion.div 
                          key={reg.id}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          className="stat-card border border-editorial-border p-8 hover:border-editorial-accent/30 hover:bg-editorial-text/[0.01] transition-all group overflow-hidden relative shadow-lg bg-editorial-bg"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <CheckCircle size={40} strokeWidth={1} />
                          </div>
                          <div className="space-y-6">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-mono text-[8px] font-black uppercase tracking-[0.4em] text-editorial-accent/60 mb-2 italic">{event?.category}</p>
                                <h4 className="serif text-2xl text-editorial-text italic group-hover:text-editorial-accent transition-colors">{event?.title}</h4>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-6 border-t border-editorial-border/30">
                              <div className="space-y-1">
                                <p className="font-mono text-[7px] text-editorial-text/20 uppercase tracking-widest">TEMPORAL</p>
                                <p className="font-mono text-[8px] text-editorial-text/60 italic">{event ? formatDate(event.date) : "N/A"}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-[7px] text-editorial-text/20 uppercase tracking-widest">STATUS</p>
                                <p className="font-mono text-[8px] text-green-500/60 font-black italic">COMPLETED</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                ) : (
                  <div className="col-span-full stat-card border border-dashed border-editorial-border py-20 text-center bg-editorial-text/[0.01] shadow-inner">
                     <p className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-editorial-text/10 italic">NULL_PAST_ATTENDANCE_LOGS</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProfilePageWrapper({ user, profile, events }: { user: User | null; profile: UserProfile | null; events: Event[] }) {
  return <PageWrapper><ProfilePage user={user} profile={profile} events={events} /></PageWrapper>;
}
