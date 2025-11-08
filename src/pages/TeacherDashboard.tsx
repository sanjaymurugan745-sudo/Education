import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  LayoutDashboard,
  FileText,
  Upload,
  ClipboardList,
  BookOpen,
  Plus,
  ExternalLink,
  Trash2,
  Edit,
  AlertCircle,
  Users, // Keep Users icon for overview
  UserPlus, 
  Calendar,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  getAllExams, 
  addExam, 
  deleteExam, 
  updateExam,
  getAllSyllabi,
  addSyllabus,
  deleteSyllabus,
  updateSyllabus,
  getAllAssignments,
  updateAssignment as localUpdateAssignment,
  deleteAssignment as localDeleteAssignment,
  addAssignment as localAddAssignment,
} from '@/lib/storage';
import { Exam, Syllabus } from '@/types/exam';
import { getCurrentUser } from '@/lib/auth';
import { AITestGenerator } from '@/components/AITestGenerator';

/**
 * Teacher Dashboard Component
 * Manages exams with Google Forms, syllabus with Google Drive, assignment reviews
 * Features: Google Drive/Form integration, real-time updates, link validation
 */
interface Student {
  id: string;
  name: string;
  email: string;
  student_id: string;
  grade_level?: string;
  created_at: string;
}

interface AssignmentDB {
  id: string;
  student_id: string;
  student_name: string;
  assignment_title: string;
  google_drive_link: string;
  submitted_at: string;
  status: string;
  grade?: string;
  feedback?: string;
  reviewed_at?: string;
}

const TeacherDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const currentUser = getCurrentUser();
  
  // Exam state
  const [exams, setExams] = useState<Exam[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examDuration, setExamDuration] = useState('');
  const [examGoogleLink, setExamGoogleLink] = useState('');
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  
  // Syllabus state
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [syllabusName, setSyllabusName] = useState('');
  const [syllabusSubject, setSyllabusSubject] = useState('');
  const [syllabusLink, setSyllabusLink] = useState('');
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  
  // Students state
  const [students, setStudents] = useState<Student[]>([]);
  
  // Assignment state
  const [assignments, setAssignments] = useState<AssignmentDB[]>([]);
  const [reviewingAssignment, setReviewingAssignment] = useState<AssignmentDB | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);
  // Bulk actions state
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [bulkGrade, setBulkGrade] = useState<string>('A');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [undoStack, setUndoStack] = useState<Array<{
    prevAssignments: AssignmentDB[];
    description: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setExams(getAllExams());
      try {
        const syllabiData = await getAllSyllabi();
        setSyllabi(syllabiData);
      } catch (error) {
        console.error('Error loading syllabi:', error);
        toast.error('Failed to load syllabi');
      }
    
    // Load students from database
    // @ts-ignore - Table types not yet generated
    const { data: studentsData, error: studentsError } = await (supabase as any)
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!studentsError && studentsData) {
      setStudents(studentsData as unknown as Student[]);
    }
    
    // Load assignments from database
    // @ts-ignore - Table types not yet generated
    const { data: assignmentsData, error: assignmentsError } = await (supabase as any)
      .from('assignments')
      .select('*')
      .order('submitted_at', { ascending: false });

    // Also include any assignments stored in localStorage (client-side fallback)
    try {
      const localAssignments = getAllAssignments();
      // convert local Assignment[] (camelCase) to AssignmentDB (snake_case) shape
      const localAsDB = localAssignments.map(a => ({
        id: a.id,
        student_id: a.studentId,
        student_name: a.studentName,
        assignment_title: a.assignmentTitle,
        google_drive_link: a.googleDriveLink,
        submitted_at: a.submittedAt,
        status: a.status,
        grade: a.grade,
        feedback: a.feedback,
      } as AssignmentDB));

      if (!assignmentsError && Array.isArray(assignmentsData)) {
        // merge, preferring server rows; add local rows that are missing
        const existingIds = new Set((assignmentsData as any).map((r: any) => String(r.id)));
        const merged = [ ...(assignmentsData as any) ];
        for (const la of localAsDB) {
          if (!existingIds.has(String(la.id))) merged.unshift(la);
        }
        setAssignments(merged as AssignmentDB[]);
      } else {
        // if server failed or returned nothing, show local assignments
        setAssignments(localAsDB);
      }
    } catch (e) {
      // fallback to server-only data or empty
      if (!assignmentsError && assignmentsData) {
        setAssignments(assignmentsData as unknown as AssignmentDB[]);
      } else {
        setAssignments([]);
      }
    }

    // Removed: Load all users from profiles
    // Removed: await loadUsers();
  };

  // Removed: const loadUsers = async () => {
  // Removed:   const { data, error } = await supabase
  // Removed:     .from('profiles')
  // Removed:     .select('id, full_name, department, role, created_at')
  // Removed:     .order('created_at', { ascending: false });
  // Removed:
  // Removed:   if (error) {
  // Removed:     console.error('Error loading users:', error);
  // Removed:     return;
  // Removed:   }
  // Removed:
  // Removed:   // Get auth users to map emails
  // Removed:   const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
  // Removed:   
  // Removed:   // Create a map of user IDs to emails
  // Removed:   const emailMap = new Map<string, string>();
  // Removed:   if (authUsers) {
  // Removed:     authUsers.forEach((u: any) => {
  // Removed:       if (u.id && u.email) {
  // Removed:         emailMap.set(u.id, u.email);
  // Removed:       }
  // Removed:     });
  // Removed:   }
  // Removed:
  // Removed:   // Map to include email from auth users
  // Removed:   const usersWithEmail = data?.map(user => ({
  // Removed:     ...user,
  // Removed:     email: emailMap.get(user.id) || `${user.full_name.toLowerCase().replace(/\s+/g, '.')}@example.com`
  // Removed:   })) || [];
  // Removed:
  // Removed:   setAllUsers(usersWithEmail as any);
  // Removed: };

  const sidebarItems = [
    {
      icon: <LayoutDashboard className="h-5 w-5" />,
      label: 'Overview',
      onClick: () => setActiveSection('overview'),
      active: activeSection === 'overview',
    },
    // Removed: {
    // Removed:   icon: <Users className="h-5 w-5" />,
    // Removed:   label: 'Manage Users',
    // Removed:   onClick: () => setActiveSection('users'),
    // Removed:   active: activeSection === 'users',
    // Removed: },
    {
      icon: <FileText className="h-5 w-5" />,
      label: 'Manage Exams',
      onClick: () => setActiveSection('exams'),
      active: activeSection === 'exams',
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      label: 'Syllabus',
      onClick: () => setActiveSection('syllabus'),
      active: activeSection === 'syllabus',
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: 'AI Test Generator',
      onClick: () => setActiveSection('ai-generator'),
      active: activeSection === 'ai-generator',
    },
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: 'Assignments',
      onClick: () => setActiveSection('assignments'),
      active: activeSection === 'assignments',
    },
  ];

  const validateGoogleLink = (link: string): boolean => {
    return link.includes('drive.google.com') || link.includes('docs.google.com') || link.includes('forms.gle') || link.includes('forms.google.com');
  };

  const handleCreateExam = () => {
    if (!examTitle.trim()) {
      toast.error('Please enter exam title');
      return;
    }
    if (!examGoogleLink.trim()) {
      toast.error('Please enter Google Form link');
      return;
    }
    if (!validateGoogleLink(examGoogleLink)) {
      toast.error('Please enter a valid Google Drive or Google Forms link');
      return;
    }

    if (editingExam) {
      updateExam(editingExam.id, {
        title: examTitle,
        description: examDescription,
        googleFormLink: examGoogleLink,
        duration: examDuration,
      });
      toast.success('Exam updated successfully!');
      setEditingExam(null);
    } else {
      addExam({
        title: examTitle,
        description: examDescription,
        googleFormLink: examGoogleLink,
        duration: examDuration,
        createdBy: currentUser?.name || 'Teacher',
        isActive: true,
      });
      toast.success('Exam created successfully!');
    }

    setExamTitle('');
    setExamDescription('');
    setExamGoogleLink('');
    setExamDuration('');
    loadData();
  };

  const handleDeleteExam = (id: string) => {
    if (deleteExam(id)) {
      toast.success('Exam deleted successfully');
      loadData();
    }
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setExamTitle(exam.title);
    setExamDescription(exam.description);
    setExamGoogleLink(exam.googleFormLink);
    setExamDuration(exam.duration);
  };

  const handleAddSyllabus = () => {
    if (!syllabusName.trim()) {
      toast.error('Please enter syllabus name');
      return;
    }
    if (!syllabusLink.trim()) {
      toast.error('Please enter Google Drive link');
      return;
    }
    if (!validateGoogleLink(syllabusLink)) {
      toast.error('Please enter a valid Google Drive or Google Docs link');
      return;
    }

    if (editingSyllabus) {
      updateSyllabus(editingSyllabus.id, {
        name: syllabusName,
        googleDriveLink: syllabusLink,
        subject: syllabusSubject,
      });
      toast.success('Syllabus updated successfully!');
      setEditingSyllabus(null);
    } else {
      addSyllabus({
        name: syllabusName,
        googleDriveLink: syllabusLink,
        subject: syllabusSubject,
        uploadedBy: currentUser?.name || 'Teacher',
      });
      toast.success('Syllabus uploaded successfully!');
    }

    setSyllabusName('');
    setSyllabusLink('');
    setSyllabusSubject('');
    loadData();
  };

  const handleDeleteSyllabus = (id: string) => {
    if (deleteSyllabus(id)) {
      toast.success('Syllabus deleted successfully');
      loadData();
    }
  };

  const handleEditSyllabus = (syllabus: Syllabus) => {
    setEditingSyllabus(syllabus);
    setSyllabusName(syllabus.name);
    setSyllabusLink(syllabus.googleDriveLink);
    setSyllabusSubject(syllabus.subject);
  };

  const handleReviewAssignment = async () => {
    if (!reviewingAssignment || !selectedGrade) {
      toast.error('Please select a grade');
      return;
    }

    // @ts-ignore - Table types not yet generated
    const { error } = await (supabase as any)
      .from('assignments')
      .update({
        status: 'Reviewed',
        grade: selectedGrade,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewingAssignment.id);

    if (error) {
      toast.error('Failed to update assignment');
      return;
    }

    toast.success('Assignment graded successfully!');
    setReviewingAssignment(null);
    setSelectedGrade('');
    loadData();
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignmentId) return;

    // @ts-ignore - Table types not yet generated
    const { error } = await (supabase as any)
      .from('assignments')
      .delete()
      .eq('id', deleteAssignmentId);

    if (error) {
      toast.error('Failed to delete assignment');
      return;
    }

    toast.success('Assignment deleted successfully');
    setDeleteAssignmentId(null);
    loadData();
  };

  const pendingAssignments = assignments.filter(a => a.status === 'Pending');

  // Helper: return assignments filtered by from/to dates and sorted newest first
  const getFilteredAndSortedAssignments = (list: AssignmentDB[], from: string | null, to: string | null) => {
    const cloned = [...list];
    let fromTs: number | null = null;
    let toTs: number | null = null;
    if (from) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0);
      fromTs = d.getTime();
    }
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      toTs = d.getTime();
    }

    const filtered = cloned.filter(a => {
      const t = new Date(a.submitted_at).getTime();
      if (fromTs !== null && t < fromTs) return false;
      if (toTs !== null && t > toTs) return false;
      return true;
    });

    filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    return filtered;
  };

  // Bulk assign grade to all visible assignments. If `deleteAfter` is true, delete them after assigning.
  const handleAssignGradeToAll = async (deleteAfter: boolean) => {
    const visible = getFilteredAndSortedAssignments(assignments, fromDate, toDate);
    if (visible.length === 0) {
      toast.error('No assignments in the selected date range to grade');
      return;
    }

    setIsProcessingBulk(true);
    // Save previous state for undo
    const prev = JSON.parse(JSON.stringify(assignments)) as AssignmentDB[];
    setUndoStack(s => [{ prevAssignments: prev, description: `Bulk grade ${bulkGrade}${deleteAfter ? ' + delete' : ''}` }, ...s]);

    const targets = visible;

    // Optimistically update UI: update only targets
    const updatedAll = assignments.map(a => targets.some(t => t.id === a.id) ? { ...a, status: 'Reviewed', grade: bulkGrade } : a);
    setAssignments(updatedAll as AssignmentDB[]);

    // Try updating on server; if fail, update local storage fallback
    const promises = targets.map(async (a) => {
      try {
        // @ts-ignore
        const { error } = await (supabase as any)
          .from('assignments')
          .update({ status: 'Reviewed', grade: bulkGrade, reviewed_at: new Date().toISOString() })
          .eq('id', a.id);

        if (error) {
          // fallback to local update
          localUpdateAssignment(a.id, { status: 'Reviewed', grade: bulkGrade });
        }
      } catch (e) {
        localUpdateAssignment(a.id, { status: 'Reviewed', grade: bulkGrade });
      }
    });

    await Promise.all(promises);

    if (deleteAfter) {
      // delete both server and local for targets
      const delPromises = targets.map(async (a) => {
        try {
          // @ts-ignore
          const { error } = await (supabase as any)
            .from('assignments')
            .delete()
            .eq('id', a.id);
          if (error) {
            localDeleteAssignment(a.id);
          }
        } catch (e) {
          localDeleteAssignment(a.id);
        }
      });
      await Promise.all(delPromises);
      // remove targets from UI
      setAssignments(prev => prev.filter(p => !targets.some(t => t.id === p.id)));
    }

    toast.success(`Assigned grade ${bulkGrade} to ${targets.length} student(s)${deleteAfter ? ' and deleted them' : ''}`);
    setIsProcessingBulk(false);
  };

  // Undo last bulk operation
  const handleUndo = async () => {
    const top = undoStack[0];
    if (!top) return;
    setIsProcessingBulk(true);

    // restore prevAssignments into UI and local storage
    setAssignments(top.prevAssignments);

    // attempt to reconcile with server: for each prev, update or insert
    const reconcile = top.prevAssignments.map(async (pa) => {
      try {
        // try update existing row
        // @ts-ignore
        const { error: updErr } = await (supabase as any)
          .from('assignments')
          .update({ status: pa.status, grade: pa.grade, reviewed_at: pa.reviewed_at || null })
          .eq('id', pa.id);

        if (updErr) {
          // insert as fallback
          // @ts-ignore
          await (supabase as any).from('assignments').insert({
            id: pa.id,
            student_id: pa.student_id,
            student_name: pa.student_name,
            assignment_title: pa.assignment_title,
            google_drive_link: pa.google_drive_link,
            submitted_at: pa.submitted_at,
            status: pa.status,
            grade: pa.grade,
            feedback: pa.feedback,
            reviewed_at: pa.reviewed_at || null,
          });
        }
      } catch (e) {
        // ensure local storage reflects the restored state
        // convert back to local shape
        localUpdateAssignment(pa.id, {
          status: pa.status as any,
          grade: pa.grade as any,
          feedback: pa.feedback as any,
        });
      }
    });

    await Promise.all(reconcile);

    // pop undo stack
    setUndoStack(s => s.slice(1));
    setIsProcessingBulk(false);
    toast.success('Undo completed');
  };

  return (
    <DashboardLayout sidebarItems={sidebarItems} title="Teacher Dashboard">
      {activeSection === 'overview' && (
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{students.length}</p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Total Exams</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{exams.length}</p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Pending Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{pendingAssignments.length}</p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Syllabi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{syllabi.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'ai-generator' && <AITestGenerator />}

      {activeSection === 'exams' && (
        <div className="space-y-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>{editingExam ? 'Edit Exam' : 'Create New Exam'}</CardTitle>
              <CardDescription>
                Set up a new examination with Google Forms integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  This exam will open in Google Forms when students click on it
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-title">Exam Title</Label>
                <Input
                  id="exam-title"
                  placeholder="e.g., Mid-term Mathematics Exam"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-duration">Duration (e.g., 60 min)</Label>
                <Input
                  id="exam-duration"
                  placeholder="e.g., 90 min"
                  value={examDuration}
                  onChange={(e) => setExamDuration(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-description">Description</Label>
                <Textarea
                  id="exam-description"
                  placeholder="Enter exam details and instructions..."
                  rows={3}
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-link">Google Form Link</Label>
                <Input
                  id="exam-link"
                  placeholder="https://forms.google.com/..."
                  value={examGoogleLink}
                  onChange={(e) => setExamGoogleLink(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateExam}>
                  <Plus className="h-4 w-4 mr-2" />
                  {editingExam ? 'Update Exam' : 'Create Exam'}
                </Button>
                {editingExam && (
                  <Button variant="outline" onClick={() => {
                    setEditingExam(null);
                    setExamTitle('');
                    setExamDescription('');
                    setExamGoogleLink('');
                    setExamDuration('');
                  }}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Active Exams</CardTitle>
              <CardDescription>Manage your exams</CardDescription>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No exams created yet. Create your first exam above.
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
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Duration: {exam.duration}</span>
                            <span>Created: {new Date(exam.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(exam.googleFormLink, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditExam(exam)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExam(exam.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'syllabus' && (
        <div className="space-y-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>{editingSyllabus ? 'Edit Syllabus' : 'Upload Syllabus'}</CardTitle>
              <CardDescription>Add or update course syllabus with Google Drive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Syllabus will open in Google Drive/Docs when students click on it
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="syllabus-name">Syllabus Name</Label>
                <Input
                  id="syllabus-name"
                  placeholder="e.g., Mathematics Course Syllabus 2025"
                  value={syllabusName}
                  onChange={(e) => setSyllabusName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="syllabus-subject">Subject</Label>
                <Input
                  id="syllabus-subject"
                  placeholder="e.g., Mathematics"
                  value={syllabusSubject}
                  onChange={(e) => setSyllabusSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="syllabus-link">Google Drive/Docs Link</Label>
                <Input
                  id="syllabus-link"
                  placeholder="https://drive.google.com/... or https://docs.google.com/..."
                  value={syllabusLink}
                  onChange={(e) => setSyllabusLink(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddSyllabus}>
                  <Upload className="h-4 w-4 mr-2" />
                  {editingSyllabus ? 'Update Syllabus' : 'Upload Syllabus'}
                </Button>
                {editingSyllabus && (
                  <Button variant="outline" onClick={() => {
                    setEditingSyllabus(null);
                    setSyllabusName('');
                    setSyllabusLink('');
                    setSyllabusSubject('');
                  }}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Uploaded Syllabi</CardTitle>
              <CardDescription>Manage course materials</CardDescription>
            </CardHeader>
            <CardContent>
              {syllabi.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No syllabi uploaded yet. Upload your first syllabus above.
                </p>
              ) : (
                <div className="space-y-2">
                  {syllabi.map((syllabus) => (
                    <div
                      key={syllabus.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-smooth"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <span className="text-sm font-medium">{syllabus.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {syllabus.subject} • Uploaded {new Date(syllabus.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(syllabus.googleDriveLink, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSyllabus(syllabus)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSyllabus(syllabus.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Assignment Reviews</CardTitle>
            <CardDescription>
              Review and grade student assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm mr-2 border rounded-lg ">From:</label>
                <input type="date" value={fromDate ?? ''} onChange={(e) => setFromDate(e.target.value || null)} className="input text-black border rounded-sm text-center" />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm mr-2">To:</label>
                <input type="date" value={toDate ?? ''} onChange={(e) => setToDate(e.target.value || null)} className="input text-black border rounded-sm text-center" />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm mr-2">Bulk grade:</label>
                <select value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value)} className="input text-black border rounded-sm text-center">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={async () => await handleAssignGradeToAll(false)} disabled={isProcessingBulk}>
                  Assign Grade to All
                </Button>
                <Button onClick={async () => await handleAssignGradeToAll(true)} variant="destructive" disabled={isProcessingBulk}>
                  Assign & Delete
                </Button>
                <Button onClick={handleUndo} disabled={undoStack.length === 0 || isProcessingBulk} variant={undoStack.length ? undefined : 'outline'}>
                  Undo
                </Button>
              </div>
            </div>

            {assignments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No assignments submitted yet.
              </p>
            ) : (
                <div className="space-y-3">
                  {getFilteredAndSortedAssignments(assignments, fromDate, toDate).map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{assignment.assignment_title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Submitted by: {assignment.student_name}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Submitted: {new Date(assignment.submitted_at).toLocaleDateString()} at {new Date(assignment.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      {assignment.status === 'Reviewed' && assignment.grade && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm font-semibold text-secondary">
                            Grade: {assignment.grade}
                          </span>
                          {assignment.reviewed_at && (
                            <span className="text-xs text-muted-foreground">
                              • Reviewed on {new Date(assignment.reviewed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm px-2.5 py-1 rounded-full font-medium ${
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
                        onClick={() => window.open(assignment.google_drive_link, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => {
                          setReviewingAssignment(assignment);
                          setSelectedGrade(assignment.grade || '');
                        }}
                        disabled={assignment.status === 'Reviewed'}
                      >
                        {assignment.status === 'Reviewed' ? 'Graded' : 'Review'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAssignmentId(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Assignment Confirmation */}
      <AlertDialog open={!!deleteAssignmentId} onOpenChange={() => setDeleteAssignmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this assignment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssignment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
