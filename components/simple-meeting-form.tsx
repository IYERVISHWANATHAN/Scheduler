import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface SimpleMeetingFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
  selectedTime?: string;
  categories: any[];
  ddfsAttendees: any[];
}

export function SimpleMeetingForm({
  open,
  onClose,
  onSuccess,
  selectedDate,
  selectedTime,
  categories,
  ddfsAttendees
}: SimpleMeetingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-adjust end time if it's less than 15 minutes after start time
      if (field === 'startTime' || field === 'endTime') {
        const startTime = new Date(`2000-01-01T${field === 'startTime' ? value : prev.startTime}:00`);
        const endTime = new Date(`2000-01-01T${field === 'endTime' ? value : prev.endTime}:00`);
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        if (field === 'startTime' && durationMinutes < 15) {
          // Auto-adjust end time to be 15 minutes after start time
          const newEndTime = new Date(startTime.getTime() + 15 * 60 * 1000);
          newData.endTime = newEndTime.toTimeString().slice(0, 5);
        }
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
        // If removing attendee, also remove from mandatory list
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

  const addBrandAttendee = () => {
    setFormData(prev => ({
      ...prev,
      brandAttendees: [...prev.brandAttendees, { name: "", designation: "" }]
    }));
  };

  const updateBrandAttendee = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      brandAttendees: prev.brandAttendees.map((attendee, i) =>
        i === index ? { ...attendee, [field]: value } : attendee
      )
    }));
  };

  const removeBrandAttendee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      brandAttendees: prev.brandAttendees.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Basic validation
      if (!formData.title.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a meeting title.",
          variant: "destructive"
        });
        return;
      }

      if (!formData.category) {
        toast({
          title: "Validation Error",
          description: "Please select a category.",
          variant: "destructive"
        });
        return;
      }

      // Validate meeting duration (at least 15 minutes)
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

      // Validate at least one mandatory attendee
      if (formData.mandatoryAttendees.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one mandatory DDFS attendee.",
          variant: "destructive"
        });
        return;
      }

      // Prepare meeting data
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

      console.log("Submitting meeting:", meetingData);

      await apiRequest("POST", "/api/meetings", meetingData);
      
      toast({
        title: "Success",
        description: "Meeting scheduled successfully"
      });

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
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

  // Filter available attendees by category
  const availableAttendees = ddfsAttendees.filter(attendee => 
    !formData.category || (attendee.categories && attendee.categories.includes(formData.category))
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule New Meeting</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Meeting Title */}
          <div>
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter meeting title"
              required
            />
          </div>

          {/* Scheduler Name */}
          <div>
            <Label htmlFor="schedulerName">Scheduler Name</Label>
            <Input
              id="schedulerName"
              value={formData.schedulerName}
              onChange={(e) => handleInputChange("schedulerName", e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category *</Label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleInputChange("startTime", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange("endTime", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              placeholder="Enter meeting location"
            />
          </div>

          {/* DDFS Attendees */}
          {availableAttendees.length > 0 && (
            <div>
              <Label>DDFS Attendees</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-3">
                <div className="grid grid-cols-1 gap-2">
                  {availableAttendees.map((attendee) => (
                    <div key={attendee.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`attendee-${attendee.id}`}
                          checked={formData.ddfsAttendees.includes(attendee.name)}
                          onChange={() => handleAttendeeToggle(attendee.name)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`attendee-${attendee.id}`} className="text-sm font-medium">
                          {attendee.name}
                        </label>
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
                          <label htmlFor={`mandatory-${attendee.id}`} className="text-xs text-red-600 font-medium">
                            Mandatory
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Selected: {formData.ddfsAttendees.length} | Mandatory: {formData.mandatoryAttendees.length}
                </div>
              </div>
            </div>
          )}

          {/* Brand Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Brand Attendees</Label>
              <Button type="button" onClick={addBrandAttendee} variant="outline" size="sm">
                Add Brand Attendee
              </Button>
            </div>
            {formData.brandAttendees.map((attendee, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <Input
                  placeholder="Name"
                  value={attendee.name}
                  onChange={(e) => updateBrandAttendee(index, "name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Designation"
                  value={attendee.designation}
                  onChange={(e) => updateBrandAttendee(index, "designation", e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={() => removeBrandAttendee(index)}
                  variant="outline"
                  size="sm"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}