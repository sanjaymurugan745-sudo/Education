import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Upload, Download, FileText, Loader2 } from 'lucide-react';

interface Syllabus {
  id: string;
  name: string;
  subject: string;
  content?: string;
}

interface Question {
  question: string;
  type: string;
  marks: number;
  unit: string;
  answer?: string;
  options?: string[];
}

interface GeneratedTest {
  questions: Question[];
}

export const AITestGenerator = () => {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedSyllabus, setSelectedSyllabus] = useState<Syllabus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    subject: '',
    googleDriveLink: '',
  });

  // Generation prompt
  const [prompt, setPrompt] = useState('');

  const loadSyllabi = async () => {
    const { data, error } = await supabase
      .from('syllabi')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSyllabi(data);
    }
  };

  useState(() => {
    loadSyllabi();
  });

  const handleUploadSyllabus = async () => {
    if (!uploadForm.name || !uploadForm.googleDriveLink) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    try {
      // Parse document content using AI
      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-document', {
        body: { fileUrl: uploadForm.googleDriveLink }
      });

      if (parseError) throw parseError;

      const { data: user } = await supabase.auth.getUser();

      // Save to database
      const { error: insertError } = await supabase
        .from('syllabi')
        .insert({
          name: uploadForm.name,
          subject: uploadForm.subject,
          google_drive_link: uploadForm.googleDriveLink,
          content: parseData.content,
          uploaded_by: user?.user?.id,
        });

      if (insertError) throw insertError;

      toast.success('Syllabus uploaded and parsed successfully!');
      setShowUploadDialog(false);
      setUploadForm({ name: '', subject: '', googleDriveLink: '' });
      loadSyllabi();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload syllabus');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateTest = async () => {
    if (!selectedSyllabus || !prompt) {
      toast.error('Please select a syllabus and enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-test', {
        body: {
          syllabusId: selectedSyllabus.id,
          prompt: prompt,
        }
      });

      if (error) {
        if (error.message?.includes('Rate limit')) {
          toast.error('AI rate limit reached. Please try again in a moment.');
        } else if (error.message?.includes('Payment')) {
          toast.error('AI credits exhausted. Please contact support.');
        } else {
          throw error;
        }
        return;
      }

      setGeneratedTest(data.questions);
      toast.success('Test generated successfully!');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate test');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadTest = () => {
    if (!generatedTest) return;

    let content = `Generated Test Paper\n`;
    content += `Syllabus: ${selectedSyllabus?.name}\n`;
    content += `Subject: ${selectedSyllabus?.subject}\n\n`;
    content += `=".repeat(50)}\n\n`;

    generatedTest.questions.forEach((q, index) => {
      content += `Question ${index + 1} (${q.marks} marks) [${q.unit}]\n`;
      content += `${q.question}\n`;
      if (q.options) {
        q.options.forEach((opt, i) => {
          content += `${String.fromCharCode(65 + i)}. ${opt}\n`;
        });
      }
      if (q.answer) {
        content += `\nAnswer: ${q.answer}\n`;
      }
      content += `\n${'-'.repeat(50)}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-${selectedSyllabus?.name}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-elegant bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg sm:text-xl">AI Test Generator</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Upload syllabus documents and generate test questions using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => setShowUploadDialog(true)} className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Upload Syllabus
            </Button>
            <Button 
              onClick={() => {
                if (syllabi.length === 0) {
                  toast.error('Please upload a syllabus first');
                  return;
                }
                setShowGenerateDialog(true);
              }}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Test
            </Button>
          </div>

          {syllabi.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-3 text-sm sm:text-base">Uploaded Syllabi</h4>
              <div className="grid gap-2 sm:gap-3">
                {syllabi.map((syl) => (
                  <div
                    key={syl.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-smooth gap-2"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <h5 className="font-medium text-sm sm:text-base truncate">{syl.name}</h5>
                        <p className="text-xs sm:text-sm text-muted-foreground">{syl.subject}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSyllabus(syl);
                        setShowGenerateDialog(true);
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">Generate</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Upload Syllabus</DialogTitle>
            <DialogDescription className="text-sm">
              Provide syllabus details and Google Drive link
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="syl-name" className="text-sm">Syllabus Name</Label>
              <Input
                id="syl-name"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g., CS101 Syllabus"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="syl-subject" className="text-sm">Subject</Label>
              <Input
                id="syl-subject"
                value={uploadForm.subject}
                onChange={(e) => setUploadForm({ ...uploadForm, subject: e.target.value })}
                placeholder="e.g., Computer Science"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="syl-link" className="text-sm">Google Drive Link</Label>
              <Input
                id="syl-link"
                value={uploadForm.googleDriveLink}
                onChange={(e) => setUploadForm({ ...uploadForm, googleDriveLink: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Make sure the document is accessible
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={isUploading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleUploadSyllabus} disabled={isUploading} className="w-full sm:w-auto">
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Test Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Generate Test with AI</DialogTitle>
            <DialogDescription className="text-sm">
              {selectedSyllabus ? `Using: ${selectedSyllabus.name}` : 'Select a syllabus and describe the test you want'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!selectedSyllabus && syllabi.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Select Syllabus</Label>
                <div className="grid gap-2">
                  {syllabi.map((syl) => (
                    <Button
                      key={syl.id}
                      variant={selectedSyllabus?.id === syl.id ? 'default' : 'outline'}
                      onClick={() => setSelectedSyllabus(syl)}
                      className="justify-start text-left"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {syl.name} - {syl.subject}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-sm">Test Requirements</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Create 10 two-mark questions from Unit 1 and 5 five-mark questions from Unit 2. Include answers."
                className="min-h-[120px] text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about units, question types, marks, and any special requirements
              </p>
            </div>

            {generatedTest && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3 max-h-[50vh] overflow-y-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                  <h4 className="font-medium text-sm sm:text-base">Generated Questions ({generatedTest.questions.length})</h4>
                  <Button size="sm" onClick={downloadTest} variant="outline" className="w-full sm:w-auto">
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="text-xs sm:text-sm">Download</span>
                  </Button>
                </div>
                <div className="space-y-4">
                  {generatedTest.questions.map((q, idx) => (
                    <div key={idx} className="border-l-2 border-primary pl-3 sm:pl-4 space-y-1 sm:space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                        <p className="font-medium text-sm">Q{idx + 1}. {q.question}</p>
                        <div className="flex gap-2">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap">
                            {q.marks} marks
                          </span>
                          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded whitespace-nowrap">
                            {q.unit}
                          </span>
                        </div>
                      </div>
                      {q.options && (
                        <div className="text-xs sm:text-sm space-y-1">
                          {q.options.map((opt, i) => (
                            <p key={i} className="text-muted-foreground">
                              {String.fromCharCode(65 + i)}. {opt}
                            </p>
                          ))}
                        </div>
                      )}
                      {q.answer && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          <span className="font-medium">Answer:</span> {q.answer}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowGenerateDialog(false);
                setGeneratedTest(null);
                setPrompt('');
              }} 
              disabled={isGenerating}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            <Button onClick={handleGenerateTest} disabled={isGenerating || !selectedSyllabus || !prompt} className="w-full sm:w-auto">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
