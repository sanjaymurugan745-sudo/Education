import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { login, getCurrentUser, initializeUsers } from '@/lib/auth';
import { toast } from 'sonner';
import { GraduationCap, Lock, User, Moon, Sun, Home } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';

/**
 * Login Page Component
 * Handles user authentication with role-based login (admin, teacher, student)
 * Features form validation and automatic redirect for authenticated users
 */
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Initialize users on component mount
    initializeUsers();

    // Redirect if already logged in
    const currentUser = getCurrentUser();
    if (currentUser) {
      navigate(`/dashboard/${currentUser.role}`, { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      // First, try localStorage auth (for default admin: sanjay/Dark and CSV-uploaded users)
      const localUser = login(username, password);
      
      if (localUser) {
        toast.success(`Welcome back, ${localUser.name}!`);
        navigate(`/dashboard/${localUser.role}`);
        setIsLoading(false);
        return;
      }

      // If localStorage fails, try Supabase Auth (email/password)
      // Note: This path is for users registered directly with Supabase Auth, not localStorage.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username, // Supabase typically uses email for signInWithPassword
        password: password,
      });

      if (error) {
        toast.error('Invalid credentials');
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Fetch user profile to get role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          toast.success(`Welcome back, ${profile.full_name}!`);
          navigate(`/dashboard/${profile.role}`);
        } else {
          toast.error('User profile not found');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    const leftSection = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - leftSection.left,
      y: e.clientY - leftSection.top
    });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const socialIcons = [
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3"/></svg>,
      href: '#',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6.94 5a2 2 0 1 1-4-.002a2 2 0 0 1 4 .002M7 8.48H3V21h4zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91z"/></svg>,
      href: '#',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396z"/></svg>,
      href: '#',
    }
  ];

  return (
    <div className="min-h-screen w-full flex flex-col bg-background overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between max-w-7xl">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="font-semibold">Back to Home</span>
          </button>
          
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 w-full flex items-center justify-center pt-20 pb-8 px-4">
        <div className='w-full max-w-6xl mx-auto flex justify-center items-stretch min-h-[600px] md:min-h-[650px] bg-card rounded-2xl overflow-hidden shadow-glow border border-border'>
          <div
          className='w-full lg:w-1/2 px-6 sm:px-8 lg:px-16 py-8 md:py-12 relative overflow-hidden flex items-center justify-center'
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={`absolute pointer-events-none w-[400px] md:w-[500px] h-[400px] md:h-[500px] bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-pink-500/20 rounded-full blur-3xl transition-opacity duration-200 ${
              isHovering ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transform: `translate(${mousePosition.x - 250}px, ${mousePosition.y - 250}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          />
          
          <form className='relative z-10 text-center w-full max-w-md mx-auto flex flex-col gap-5 md:gap-6' onSubmit={handleLogin}>
            <div className='grid gap-4 md:gap-6'>
          <div className="flex items-center justify-center mb-2 md:mb-4">
                <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-primary mr-2 md:mr-3" />
                <h1 className='text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground'>Sign In</h1>
              </div>
              
              <div className="social-container">
                <div className="flex items-center justify-center">
                  <ul className="flex gap-3 md:gap-4">
                    {socialIcons.map((social, index) => (
                      <li key={index} className="list-none">
                        <a
                          href={social.href}
                          className="w-10 h-10 md:w-12 md:h-12 bg-white/5 dark:bg-white/5 rounded-full flex justify-center items-center relative z-[1] border-2 border-border overflow-hidden group hover:border-primary transition-all duration-300"
                        >
                          <div className="absolute inset-0 w-full h-full bg-primary scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100" />
                          <span className="text-foreground/70 transition-all duration-500 ease-in-out z-[2] group-hover:text-primary-foreground text-sm md:text-base">
                            {social.icon}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <span className='text-xs md:text-sm text-muted-foreground'>or use your account</span>
            </div>
            
            <div className='grid gap-3 md:gap-4 items-center'>
              <div className="w-full relative">
                <input
                  type="text"
                  className="peer relative z-10 border-2 border-input h-12 w-full rounded-md bg-background px-4 font-thin outline-none transition-all duration-200 ease-in-out focus:bg-muted focus:border-primary placeholder:font-normal placeholder:text-muted-foreground text-foreground"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
              
              <div className="w-full relative">
                <input
                  type="password"
                  className="peer relative z-10 border-2 border-input h-12 w-full rounded-md bg-background px-4 font-thin outline-none transition-all duration-200 ease-in-out focus:bg-muted focus:border-primary placeholder:font-normal placeholder:text-muted-foreground text-foreground"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            <a href="#" className='font-light text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors'>Forgot your password?</a>
            
            <div className='flex gap-4 justify-center items-center mt-2'>
              <button 
                type="submit"
                disabled={isLoading}
                className="group/button relative inline-flex justify-center items-center overflow-hidden rounded-md bg-primary px-6 md:px-8 py-2.5 md:py-3 text-xs md:text-sm font-medium text-white transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-xs"
              >
                <span className="text-xs md:text-sm">{isLoading ? 'Signing in...' : 'Sign In'}</span>
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/20" />
                </div>
              </button>
            </div>
          </form>
        </div>
        
        <div className='hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center'>
          <img
            src='https://images.pexels.com/photos/7102037/pexels-photo-7102037.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
            alt="Education background"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#0a0a0a]/80" />
        </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
