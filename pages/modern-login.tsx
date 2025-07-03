import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { WabiSabiLayout, WabiSabiCard, WabiSabiButton, WabiSabiInput, WabiSabiBadge } from "@/components/wabi-sabi-layout";
import { Loader2, LogIn, Calendar, CheckCircle, Users, Clock, Shield, Sparkles, Leaf, Sun } from "lucide-react";
import backgroundImage from "@assets/Flat_openSpace_offices_13_1750331579471.jpg";

export default function ModernLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        setLocation('/');
      } else {
        toast({
          title: "Authentication Failed",
          description: "Please check your credentials and try again",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred during login",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WabiSabiLayout className="min-h-screen flex items-center justify-center p-6">
      {/* Natural background with organic overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Organic overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-wabi-cream/90 via-wabi-sand/80 to-wabi-mist/90"></div>
      
      <div className="relative z-10 w-full max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Branding and Features */}
          <div className="space-y-10 lg:pr-12">
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-wabi-earth to-wabi-clay rounded-3xl flex items-center justify-center shadow-organic-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="wabi-heading text-5xl text-wabi-charcoal">Calendar Scheduler</h1>
                  <div className="flex items-center space-x-2 mt-2">
                    <Leaf className="h-4 w-4 text-wabi-sage" />
                    <span className="wabi-accent-text text-sm">Modern • Natural • Intuitive</span>
                  </div>
                </div>
              </div>
              <p className="wabi-body text-xl leading-relaxed">
                Experience harmonious team scheduling with intelligent meeting management, 
                mindful conflict resolution, and seamless calendar integration designed 
                for modern collaboration.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-wabi-sage/20 to-wabi-sage/10 rounded-2xl flex items-center justify-center border border-wabi-sage/20">
                  <CheckCircle className="h-6 w-6 text-wabi-sage" />
                </div>
                <div>
                  <h3 className="wabi-heading text-lg text-wabi-charcoal">Mindful Scheduling</h3>
                  <p className="wabi-body text-sm mt-1">
                    AI-powered conflict detection with respect for natural work rhythms
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-wabi-earth/20 to-wabi-earth/10 rounded-2xl flex items-center justify-center border border-wabi-earth/20">
                  <Users className="h-6 w-6 text-wabi-earth" />
                </div>
                <div>
                  <h3 className="wabi-heading text-lg text-wabi-charcoal">Harmonious Teams</h3>
                  <p className="wabi-body text-sm mt-1">
                    Thoughtful collaboration with balanced attendee management
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-wabi-clay/20 to-wabi-clay/10 rounded-2xl flex items-center justify-center border border-wabi-clay/20">
                  <Clock className="h-6 w-6 text-wabi-clay" />
                </div>
                <div>
                  <h3 className="wabi-heading text-lg text-wabi-charcoal">Natural Flow</h3>
                  <p className="wabi-body text-sm mt-1">
                    Gentle notifications that respect your focus and rhythm
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-wabi-stone/20 to-wabi-stone/10 rounded-2xl flex items-center justify-center border border-wabi-stone/20">
                  <Shield className="h-6 w-6 text-wabi-stone" />
                </div>
                <div>
                  <h3 className="wabi-heading text-lg text-wabi-charcoal">Trusted Security</h3>
                  <p className="wabi-body text-sm mt-1">
                    Organic security architecture with thoughtful permissions
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="flex justify-center lg:justify-end">
            <WabiSabiCard className="w-full max-w-lg bg-white/95 backdrop-blur-md shadow-organic-xl border border-wabi-stone/10">
              <CardHeader className="space-y-3 text-center pb-8">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-wabi-earth to-wabi-clay rounded-3xl flex items-center justify-center shadow-organic">
                    <Sun className="h-8 w-8 text-white" />
                  </div>
                </div>
                <CardTitle className="wabi-heading text-3xl text-wabi-charcoal">Welcome Back</CardTitle>
                <CardDescription className="wabi-body text-lg">
                  Sign in to your mindful workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-8 pb-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <label htmlFor="email" className="wabi-accent-text text-sm font-medium">
                      Email Address
                    </label>
                    <WabiSabiInput
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <label htmlFor="password" className="wabi-accent-text text-sm font-medium">
                      Password
                    </label>
                    <WabiSabiInput
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="h-12 text-base"
                    />
                  </div>

                  <WabiSabiButton
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-wabi-earth to-wabi-charcoal hover:from-wabi-charcoal hover:to-wabi-earth text-white font-medium text-base shadow-organic-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-3 h-5 w-5" />
                        Sign In
                      </>
                    )}
                  </WabiSabiButton>
                </form>

                {/* Demo Users Section */}
                <div className="pt-6 border-t border-wabi-stone/20">
                  <p className="wabi-accent-text text-sm mb-4 text-center">Demo Users Available:</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-3 bg-wabi-sand/30 rounded-xl border border-wabi-stone/10">
                      <span className="font-medium text-wabi-charcoal">Admin:</span>
                      <span className="wabi-body text-xs">admin@delhidutyfree.co.in</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-wabi-sand/30 rounded-xl border border-wabi-stone/10">
                      <span className="font-medium text-wabi-charcoal">Manager:</span>
                      <span className="wabi-body text-xs">manager@delhidutyfree.co.in</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-wabi-sand/30 rounded-xl border border-wabi-stone/10">
                      <span className="font-medium text-wabi-charcoal">Staff:</span>
                      <span className="wabi-body text-xs">staff@delhidutyfree.co.in</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-wabi-sand/30 rounded-xl border border-wabi-stone/10">
                      <span className="font-medium text-wabi-charcoal">Guest:</span>
                      <span className="wabi-body text-xs">guest@delhidutyfree.co.in</span>
                    </div>
                    <p className="text-center wabi-body text-xs mt-3">
                      Password: <WabiSabiBadge className="bg-wabi-mist text-wabi-charcoal text-xs">password123</WabiSabiBadge>
                    </p>
                  </div>
                </div>
              </CardContent>
            </WabiSabiCard>
          </div>
        </div>
      </div>
    </WabiSabiLayout>
  );
}