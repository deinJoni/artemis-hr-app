import * as React from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { CSVImportPreview, CSVImportConfirm, CSVImportResult } from "@vibe/shared";

type ImportStep = "upload" | "mapping" | "preview" | "confirm" | "complete";

type ImportWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  apiBaseUrl: string;
  tenantId: string;
};

export function ImportWizard({ isOpen, onClose, onComplete, apiBaseUrl, tenantId }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<ImportStep>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<CSVImportPreview | null>(null);
  const [fieldMapping, setFieldMapping] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<CSVImportResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const availableFields = [
    { key: "name", label: "Full Name", required: true },
    { key: "email", label: "Email", required: true },
    { key: "employee_number", label: "Employee Number", required: false },
    { key: "job_title", label: "Job Title", required: false },
    { key: "department_name", label: "Department", required: false },
    { key: "manager_email", label: "Manager Email", required: false },
    { key: "phone_work", label: "Work Phone", required: false },
    { key: "start_date", label: "Start Date", required: false },
    { key: "employment_type", label: "Employment Type", required: false },
    { key: "work_location", label: "Work Location", required: false },
    { key: "status", label: "Status", required: false },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/import/preview`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setPreview(data);
      
      // Auto-map fields based on column names
      const autoMapping: Record<string, string> = {};
      if (data.fieldMapping) {
        Object.entries(data.fieldMapping).forEach(([csvColumn, fieldKey]) => {
          if (fieldKey && typeof fieldKey === 'string' && availableFields.some(f => f.key === fieldKey)) {
            autoMapping[csvColumn] = fieldKey;
          }
        });
      }
      setFieldMapping(autoMapping);
      
      setCurrentStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (csvColumn: string, fieldKey: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvColumn]: fieldKey
    }));
  };

  const handlePreview = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validRows: preview.validRows,
          fieldMapping: fieldMapping,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Preview failed");
      }

      setPreview(data);
      setCurrentStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validRows: preview.validRows,
          fieldMapping: fieldMapping,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      setCurrentStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setFile(null);
    setPreview(null);
    setFieldMapping({});
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleComplete = () => {
    handleReset();
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold">Import Employees</h2>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[
                { key: "upload", label: "Upload", icon: Upload },
                { key: "mapping", label: "Mapping", icon: FileText },
                { key: "preview", label: "Preview", icon: CheckCircle },
                { key: "confirm", label: "Import", icon: Download },
              ].map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.key;
                const isCompleted = ["upload", "mapping", "preview", "confirm"].indexOf(currentStep) > index;
                
                return (
                  <div key={step.key} className="flex items-center">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && "border-green-500 bg-green-500 text-white",
                      !isActive && !isCompleted && "border-muted-foreground text-muted-foreground"
                    )}>
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      "ml-2 text-sm font-medium",
                      isActive && "text-primary",
                      isCompleted && "text-green-600",
                      !isActive && !isCompleted && "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                    {index < 3 && (
                      <div className={cn(
                        "w-8 h-0.5 mx-4",
                        isCompleted ? "bg-green-500" : "bg-muted-foreground"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 border border-destructive/40 bg-destructive/10 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-destructive mr-2" />
                <span className="text-destructive">{error}</span>
              </div>
            </div>
          )}

          {/* Step Content */}
          {currentStep === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV File</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select a CSV file containing employee data to import.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {file ? file.name : "Choose CSV file"}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop your CSV file here, or click to browse
                    </p>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Select File
                    </Button>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-2">CSV Format Requirements:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>First row must contain column headers</li>
                      <li>Required columns: Name, Email</li>
                      <li>Optional columns: Employee Number, Job Title, Department, etc.</li>
                      <li>Date format: YYYY-MM-DD</li>
                    </ul>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpload} 
                      disabled={!file || loading}
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Upload & Preview
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === "mapping" && preview && (
            <Card>
              <CardHeader>
                <CardTitle>Map CSV Columns</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Map your CSV columns to employee fields. Required fields are marked with *.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {Object.keys(preview.fieldMapping).map(csvColumn => (
                      <div key={csvColumn} className="flex items-center space-x-4">
                        <div className="w-48 text-sm font-medium">{csvColumn}</div>
                        <div className="flex-1">
                          <select
                            value={fieldMapping[csvColumn] || ""}
                            onChange={(e) => handleMappingChange(csvColumn, e.target.value)}
                            className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                          >
                            <option value="">Skip this column</option>
                            {availableFields.map(field => (
                              <option key={field.key} value={field.key}>
                                {field.label} {field.required && "*"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCurrentStep("upload")}>
                      Back
                    </Button>
                    <Button onClick={handlePreview} disabled={loading}>
                      {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Preview Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === "preview" && preview && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Import</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review the data before importing. {preview.validRows.length} valid rows, {preview.invalidRows.length} invalid rows.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {preview.invalidRows.length > 0 && (
                    <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg">
                      <h4 className="font-medium text-destructive mb-2">Invalid Rows ({preview.invalidRows.length})</h4>
                      <div className="space-y-2">
                        {preview.invalidRows.slice(0, 5).map((row, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">Row {row.row}:</span> {row.errors.join(", ")}
                          </div>
                        ))}
                        {preview.invalidRows.length > 5 && (
                          <div className="text-sm text-muted-foreground">
                            ... and {preview.invalidRows.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {Object.keys(preview.validRows[0] || {}).map(column => (
                            <th key={column} className="px-3 py-2 text-left font-medium">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.validRows.slice(0, 10).map((row, index) => (
                          <tr key={index} className="border-t">
                            {Object.values(row).map((value, colIndex) => (
                              <td key={colIndex} className="px-3 py-2">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.validRows.length > 10 && (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        ... and {preview.validRows.length - 10} more rows
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCurrentStep("mapping")}>
                      Back
                    </Button>
                    <Button 
                      onClick={handleImport} 
                      disabled={loading || preview.validRows.length === 0}
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Import {preview.validRows.length} Employees
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === "complete" && result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  Import Complete
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  The import process has finished. Review the results below.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{result.created}</div>
                      <div className="text-sm text-muted-foreground">Created</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
                      <div className="text-sm text-muted-foreground">Updated</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>
                  
                  {result.errors.length > 0 && (
                    <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg">
                      <h4 className="font-medium text-destructive mb-2">Errors</h4>
                      <div className="space-y-1">
                        {result.errors.map((error, index) => (
                          <div key={index} className="text-sm text-destructive">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {result.warnings.length > 0 && (
                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                      <div className="space-y-1">
                        {result.warnings.map((warning, index) => (
                          <div key={index} className="text-sm text-yellow-700">
                            {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={handleReset}>
                      Import More
                    </Button>
                    <Button onClick={handleComplete}>
                      Done
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

