import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Eye, EyeOff } from 'lucide-react';
import { useLocation } from 'wouter';
import officeBg from '../assets/office-background.jpg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const success = await login(email, password);
    if (success) {
      setLocation('/');
    }

    setIsLoading(false);
  };

  // Removed auto-fill functionality - users must enter credentials manually

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-8 relative" 
      style={{ 
        minHeight: '100svh',
        backgroundImage: `url(${officeBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Background overlay for better contrast */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]"></div>
      
      <div className="w-full max-w-sm space-y-4 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Calendar className="text-blue-600 text-3xl" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Meeting Scheduler</h1>
          <p className="text-sm text-gray-600 mt-1">Sign in to access your calendar</p>
        </div>

        {/* Login Form */}
        <Card className="border-0 shadow-2xl backdrop-blur-sm bg-white/95">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription className="text-sm">Enter your credentials to continue</CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 px-6">
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="mt-1 h-11 text-base"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="h-11 text-base pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex-col space-y-3 px-6 pt-2">
              <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </CardFooter>
          </form>
        </Card>


      </div>
    </div>
  );
}