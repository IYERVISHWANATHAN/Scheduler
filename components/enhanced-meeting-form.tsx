import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Clock, Users, AlertTriangle, CheckCircle } from "lucide-react";

interface EnhancedMeetingFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
  selectedTime?: string;
  categories: any[];
  ddfsAttendees: any[];
}

const categoryColors = {
  liquor: "bg-purple-100 text-purple-800 border-purple-200",
  tobacco: "bg-orange-100 text-orange-800 border-orange-200", 
  pnc: "bg-blue-100 text-blue-800 border-blue-200",
  confectionary: "bg-pink-100 text-pink-800 border-pink-200",
  fashion: "bg-green-100 text-green-800 border-green-200",
  destination: "bg-yellow-100 text-yellow-800 border-yellow-200"
};

export function EnhancedMeetingForm({
  open,
  onClose,
  onSuccess,
  selectedDate,
  selectedTime,
  categories,
  ddfsAttendees
}: EnhancedMeetingFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [workingHoursError, setWorkingHoursError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    schedulerName: "",
    category: "",
    date: format(selectedDate, 'yyyy-MM-dd'),
    startTime: selectedTime || "09:00",
    endTime: selectedTime ? format(new Date(`2000-01-01T${selectedTime}:00`).getTime() + 3600000, 'HH:mm') : "10:00",
    location: "",
    ddfsAttendees: [] as string[],
    mandatoryAttendees: [] as string[],
    brandAttendees: [] as { name: string; designation: string }[]
  });

  const { toast } = useToast();

  // Working hours validation (8 AM - 8 PM)
  const validateWorkingHours = (startTime: string, endTime: string) => {
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    
    if (start < 8 || end > 20 || start >= end) {
      setWorkingHoursError("Meetings must be scheduled between 8:00 AM and 8:00 PM");
      return false;
    }
    setWorkingHoursError("");
    return true;
  };

  // Check for conflicts with existing meetings
  const checkConflicts = async () => {
    if (formData.mandatoryAttendees.length === 0) return;

    try {
      const response = await apiRequest("POST", "/api/meetings/check-conflicts", {
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        mandatoryAttendees: formData.mandatoryAttendees
      });
      
      setConflicts(response.conflicts || []);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-adjust end time if needed
      if (field === 'startTime') {
        const startTime = new Date(`2000-01-01T${value}:00`);
        const endTime = new Date(`2000-01-01T${prev.endTime}:00`);
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        if (durationMinutes < 15) {
          const newEndTime = new Date(startTime.getTime() + 15 * 60 * 1000);
          newData.endTime = newEndTime.toTimeString().slice(0, 5);
        }
        
        validateWorkingHours(value, newData.endTime);
      }
      
      if (field === 'endTime') {
        validateWorkingHours(prev.startTime, value);
      }
      
      return newData;
    });
  };

  const handleAttendeeToggle = (attendeeName: string) => {
    setFormData(prev => {
      const isRemoving = prev.ddfsAttendees.includes(attendeeName);
      return {
        ...prev,
        ddfsAttendees: isRemoving
          ? prev.ddfsAttendees.filter(name => name !== attendeeName)
          : [...prev.ddfsAttendees, attendeeName],
        mandatoryAttendees: isRemoving
          ? prev.mandatoryAttendees.filter(name => name !== attendeeName)
          : prev.mandatoryAttendees
      };
    });
  };

  const handleMandatoryToggle = (attendeeName: string) => {
    setFormData(prev => ({
      ...prev,
      mandatoryAttendees: prev.mandatoryAttendees.includes(attendeeName)
        ? prev.mandatoryAttendees.filter(name => name !== attendeeName)
        : [...prev.mandatoryAttendees, attendeeName]
    }));
  };

  const nextStep = () => {
    if (currentStep === 1) {
      // Validate basic info
      if (!formData.title.trim() || !formData.category) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive"
        });
        return;
      }
      
      if (workingHoursError) {
        toast({
          title: "Validation Error", 
          description: workingHoursError,
          variant: "destructive"
        });
        return;
      }
    }
    
    if (currentStep === 2) {
      // Check conflicts before proceeding
      checkConflicts();
    }
    
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Final validations
      if (formData.mandatoryAttendees.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one mandatory DDFS attendee.",
          variant: "destructive"
        });
        return;
      }

      const startTime = new Date(`2000-01-01T${formData.startTime}:00`);
      const endTime = new Date(`2000-01-01T${formData.endTime}:00`);
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      if (durationMinutes < 15) {
        toast({
          title: "Validation Error",
          description: "Meeting duration must be at least 15 minutes.",
          variant: "destructive"
        });
        return;
      }

      const meetingData = {
        title: formData.title,
        schedulerName: formData.schedulerName || "Unknown",
        category: formData.category,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location,
        status: "confirmed",
        ddfsAttendees: formData.ddfsAttendees,
        mandatoryAttendees: formData.mandatoryAttendees,
        brandAttendees: formData.brandAttendees
          .filter(attendee => attendee.name.trim())
          .map(attendee => JSON.stringify(attendee))
      };

      await apiRequest("POST", "/api/meetings", meetingData);
      
      toast({
        title: "Success",
        description: "Meeting scheduled successfully"
      });

      onSuccess();
      onClose();
      setCurrentStep(1);
      
    } catch (error: any) {
      console.error("Meeting creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableAttendees = ddfsAttendees.filter(attendee => 
    !formData.category || (attendee.categories && attendee.categories.includes(formData.category))
  );

  const progressPercentage = (currentStep / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule New Meeting
          </DialogTitle>
          <div className="space-y-2">
            <Progress value={progressPercentage} className="w-full" />
            <div className="flex justify-between text-sm text-gray-500">
              <span className={currentStep === 1 ? "font-medium text-blue-600" : ""}>
                Basic Info
              </span>
              <span className={currentStep === 2 ? "font-medium text-blue-600" : ""}>
                Attendees
              </span>
              <span className={currentStep === 3 ? "font-medium text-blue-600" : ""}>
                Review
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Enter meeting title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="schedulerName">Scheduler Name</Label>
                  <Input
                    id="schedulerName"
                    value={formData.schedulerName}
                    onChange={(e) => handleInputChange("schedulerName", e.target.value)}
                    placeholder="Enter your name"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {categories.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => handleInputChange("category", category.key)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        formData.category === category.key
                          ? `${categoryColors[category.key as keyof typeof categoryColors]} border-current`
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="font-medium">{category.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange("startTime", e.target.value)}
                      className="mt-1 pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange("endTime", e.target.value)}
                      className="mt-1 pl-10"
                    />
                  </div>
                </div>
              </div>

              {workingHoursError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{workingHoursError}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  placeholder="Enter meeting location"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Attendees */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5" />
                <h3 className="text-lg font-medium">Select Attendees</h3>
                <Badge variant="outline">
                  {formData.ddfsAttendees.length} selected
                </Badge>
              </div>

              {availableAttendees.length > 0 && (
                <div className="space-y-3">
                  {availableAttendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.ddfsAttendees.includes(attendee.name)
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`attendee-${attendee.id}`}
                            checked={formData.ddfsAttendees.includes(attendee.name)}
                            onChange={() => handleAttendeeToggle(attendee.name)}
                            className="h-5 w-5 rounded border-gray-300"
                          />
                          <div>
                            <label htmlFor={`attendee-${attendee.id}`} className="font-medium cursor-pointer">
                              {attendee.name}
                            </label>
                            <div className="text-sm text-gray-500">{attendee.email}</div>
                          </div>
                        </div>
                        
                        {formData.ddfsAttendees.includes(attendee.name) && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`mandatory-${attendee.id}`}
                              checked={formData.mandatoryAttendees.includes(attendee.name)}
                              onChange={() => handleMandatoryToggle(attendee.name)}
                              className="h-4 w-4 text-red-600"
                            />
                            <label htmlFor={`mandatory-${attendee.id}`} className="text-sm font-medium text-red-600">
                              Mandatory
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  Selected: <span className="font-medium">{formData.ddfsAttendees.length}</span> |
                  Mandatory: <span className="font-medium text-red-600">{formData.mandatoryAttendees.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-medium">Review Meeting Details</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm text-gray-600">Title</div>
                  <div className="font-medium">{formData.title}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Category</div>
                  <Badge className={categoryColors[formData.category as keyof typeof categoryColors]}>
                    {categories.find(c => c.key === formData.category)?.label}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Date & Time</div>
                  <div className="font-medium">
                    {format(new Date(formData.date), 'MMM d, yyyy')} | {formData.startTime} - {formData.endTime}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="font-medium">{formData.location || "Not specified"}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-2">Attendees</div>
                <div className="space-y-2">
                  {formData.ddfsAttendees.map((attendeeName) => (
                    <div key={attendeeName} className="flex items-center justify-between p-2 bg-white rounded border">
                      <span>{attendeeName}</span>
                      {formData.mandatoryAttendees.includes(attendeeName) && (
                        <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {conflicts.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Scheduling Conflicts Detected:</div>
                    <ul className="list-disc list-inside text-sm">
                      {conflicts.map((conflict, index) => (
                        <li key={index}>{conflict.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={currentStep === 1 ? onClose : prevStep}
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            
            {currentStep < 3 ? (
              <Button type="button" onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}