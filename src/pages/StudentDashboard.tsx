import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  LayoutDashboard,
  BookOpen,
  FileText,
  Upload,
  ExternalLink,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import {
  getActiveExams,
  getAllSyllabi,
  addAssignment,
  getAssignmentsByStudent,
} from '@/lib/storage';
import { Exam, Syllabus, Assignment } from '@/types/exam';
import { getCurrentUser } from '@/lib/auth';

/**
 * Student Dashboard Component
 * View syllabus, take exams via Google Forms, submit assignments to Google Drive
 * Features: Google integration, real-time updates, assignment tracking
 */
const StudentDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const currentUser = getCurrentUser();
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentLink, setAssignmentLink] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setExams(getActiveExams());
    setSyllabi(getAllSyllabi());
    if (currentUser) {
      setAssignments(getAssignmentsByStudent(currentUser.id));
    }
  };

  const sidebarItems = [
    {
      icon: <LayoutDashboard className="h-5 w-5" />,
      label: 'Overview',
      onClick: () => setActiveSection('overview'),
      active: activeSection === 'overview',
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      label: 'Syllabus',
      onClick: () => setActiveSection('syllabus'),
      active: activeSection === 'syllabus',
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: 'Exams',
      onClick: () => setActiveSection('exams'),
      active: activeSection === 'exams',
    },
    {
      icon: <Upload className="h-5 w-5" />,
      label: 'Assignments',
      onClick: () => setActiveSection('assignments'),
      active: activeSection === 'assignments',
    },
  ];

  const validateGoogleLink = (link: string): boolean => {
    return link.includes('drive.google.com') || link.includes('docs.google.com');
  };

  const handleSubmitAssignment = () => {
    if (!assignmentTitle.trim()) {
      toast.error('Please enter assignment title');
      return;
    }
    if (!assignmentLink.trim()) {
      toast.error('Please enter Google Drive link');
      return;
    }
    if (!validateGoogleLink(assignmentLink)) {
      toast.error('Please enter a valid Google Drive link');
      return;
    }

    if (!currentUser) {
      toast.error('User not found');
      return;
    }

    addAssignment({
      studentName: currentUser.name,
      studentId: currentUser.id,
      assignmentTitle,
      googleDriveLink: assignmentLink,
    });

    toast.success('Assignment submitted successfully!');
    setShowSubmitDialog(false);
    setAssignmentTitle('');
    setAssignmentLink('');
    loadData();
  };

  const pendingAssignments = assignments.filter(a => a.status === 'Pending').length;

  return (
    <DashboardLayout sidebarItems={sidebarItems} title="Student Dashboard">
      {activeSection === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="gradient-card shadow-elegant">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Available Exams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">{exams.length}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card shadow-elegant">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Syllabus Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">{syllabi.length}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card shadow-elegant">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Pending Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">{pendingAssignments}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">assignments</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeSection === 'syllabus' && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Course Syllabus</CardTitle>
            <CardDescription>
              Access your course materials from Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syllabi.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No syllabus files available yet. Your teacher will upload them soon.
              </p>
            ) : (
              <div className="space-y-3">
                {syllabi.map((syllabus) => (
                  <div
                    key={syllabus.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <div>
                        <h4 className="font-medium">{syllabus.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {syllabus.subject} • Uploaded {new Date(syllabus.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(syllabus.googleDriveLink, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'exams' && (
        <div className="space-y-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Available Exams</CardTitle>
              <CardDescription>Click to start an exam in Google Forms</CardDescription>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No exams available at the moment. Check back later.
                </p>
              ) : (
                <div className="space-y-3">
                  {exams.map((exam) => (
                    <div
                      key={exam.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-smooth"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{exam.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {exam.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              Duration: {exam.duration}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
                            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              This test will open in Google Forms in a new tab
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => window.open(exam.googleFormLink, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Start Exam
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'assignments' && (
        <div className="space-y-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Submit Assignment</CardTitle>
              <CardDescription>
                Upload your assignment via Google Drive link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
                    How to submit assignments:
                  </p>
                  <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Upload your assignment to Google Drive</li>
                    <li>Set sharing to "Anyone with the link can view"</li>
                    <li>Copy the sharing link</li>
                    <li>Click "Link Upload" below and paste the link</li>
                  </ol>
                </div>
              </div>

              <Button onClick={() => setShowSubmitDialog(true)}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Link Upload
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Submitted Assignments</CardTitle>
              <CardDescription>Track your assignment submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No assignments submitted yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{assignment.assignmentTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(assignment.submittedAt).toLocaleDateString()}
                        </p>
                        {assignment.grade && (
                          <p className="text-sm mt-1 font-medium text-secondary">
                            Grade: {assignment.grade}
                          </p>
                        )}
                        {assignment.feedback && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Feedback: {assignment.feedback}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm px-2.5 py-0.5 rounded-full ${
                            assignment.status === 'Pending'
                              ? 'bg-accent/10 text-accent'
                              : 'bg-secondary/10 text-secondary'
                          }`}
                        >
                          {assignment.status}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(assignment.googleDriveLink, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submit Assignment Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
            <DialogDescription>
              Enter your assignment details and Google Drive link
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-title">Assignment Title</Label>
              <Input
                id="assignment-title"
                placeholder="e.g., Math Assignment 1"
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-link">Google Drive Link</Label>
              <Input
                id="assignment-link"
                placeholder="https://drive.google.com/..."
                value={assignmentLink}
                onChange={(e) => setAssignmentLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Make sure the file is shared with "Anyone with the link can view"
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAssignment}>
              Submit Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentDashboard;
