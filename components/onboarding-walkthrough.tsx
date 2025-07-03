import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Calendar, Users, Settings, BarChart, FileText, CheckCircle } from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Calendar Scheduler',
    description: 'Get ready to streamline your meeting management with our powerful scheduling platform. This tour will guide you through the key features.',
    icon: <Calendar className="h-8 w-8 text-blue-500" />,
  },
  {
    id: 'calendar-view',
    title: 'Calendar View',
    description: 'Navigate your schedule with our intuitive calendar interface. Switch between day and week views to see your meetings clearly.',
    icon: <Calendar className="h-8 w-8 text-green-500" />,
    target: '.calendar-container',
  },
  {
    id: 'attendee-management',
    title: 'Attendee Management',
    description: 'Easily manage DDFS attendees, mandatory participants, and brand representatives for your meetings.',
    icon: <Users className="h-8 w-8 text-purple-500" />,
    target: '.attendee-section',
  },
  {
    id: 'scheduling',
    title: 'Smart Scheduling',
    description: 'Create meetings with conflict detection, buffer time management, and automatic availability checking.',
    icon: <Calendar className="h-8 w-8 text-orange-500" />,
    target: '.new-meeting-btn',
  },
  {
    id: 'settings',
    title: 'Settings & Configuration',
    description: 'Customize your preferences, manage users, and configure global settings to match your workflow.',
    icon: <Settings className="h-8 w-8 text-gray-500" />,
    target: '.settings-nav',
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    description: 'Track meeting trends, analyze productivity, and generate reports to optimize your scheduling process.',
    icon: <BarChart className="h-8 w-8 text-indigo-500" />,
    target: '.analytics-nav',
  },
  {
    id: 'export',
    title: 'Export & Integration',
    description: 'Export your schedules to Excel, sync with external calendars, and integrate with your existing tools.',
    icon: <FileText className="h-8 w-8 text-teal-500" />,
    target: '.export-section',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Congratulations! You\'re now ready to make the most of your calendar scheduling platform. Start creating meetings and managing your schedule efficiently.',
    icon: <CheckCircle className="h-8 w-8 text-emerald-500" />,
  },
];

interface OnboardingWalkthroughProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingWalkthrough({ onComplete, onSkip }: OnboardingWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const currentStepData = onboardingSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  const handleNext = () => {
    if (isAnimating) return;
    
    if (isLastStep) {
      onComplete();
      setIsOpen(false);
      return;
    }
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 150);
  };

  const handlePrevious = () => {
    if (isAnimating || isFirstStep) return;
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 150);
  };

  const handleSkip = () => {
    onSkip();
    setIsOpen(false);
  };

  const highlightElement = (selector: string) => {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('onboarding-highlight');
      return () => element.classList.remove('onboarding-highlight');
    }
    return () => {};
  };

  useEffect(() => {
    if (currentStepData.target) {
      const cleanup = highlightElement(currentStepData.target);
      return cleanup;
    }
  }, [currentStepData.target]);

  const progressPercentage = ((currentStep + 1) / onboardingSteps.length) * 100;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for highlighting targeted elements */}
      {currentStepData.target && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 pointer-events-none" />
      )}
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl z-50">
          {!isFirstStep && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="absolute right-0 top-0 text-gray-500 hover:text-gray-700 z-10"
              >
                <X className="h-4 w-4 mr-1" />
                Skip Tour
              </Button>
            </div>
          )}
          
          <DialogHeader className="pt-12 pb-6">
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            {/* Step Counter */}
            <div className="flex justify-center mb-2">
              <Badge variant="secondary" className="text-xs">
                Step {currentStep + 1} of {onboardingSteps.length}
              </Badge>
            </div>
          </DialogHeader>

          <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'}`}>
            <div className="text-center space-y-6 py-6">
              {/* Icon */}
              <div className="flex justify-center">
                {currentStepData.icon}
              </div>
              
              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentStepData.title}
              </h2>
              
              {/* Description */}
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed max-w-lg mx-auto">
                {currentStepData.description}
              </p>
              
              {/* Action hint */}
              {currentStepData.action && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                    💡 {currentStepData.action}
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isFirstStep || isAnimating}
                className="flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>
              
              <div className="flex space-x-2">
                {onboardingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep 
                        ? 'bg-blue-500' 
                        : index < currentStep 
                          ? 'bg-green-500' 
                          : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                onClick={handleNext}
                disabled={isAnimating}
                className="flex items-center space-x-2"
              >
                <span>{isLastStep ? 'Get Started' : 'Next'}</span>
                {!isLastStep && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}