import * as React from "react";
import { Download, FileDown, Image, FileText } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface OrgChartControlsProps {
  onExportSVG?: () => void;
  onExportPNG?: () => void;
  onExportPDF?: () => void;
  chartRef?: React.RefObject<HTMLElement | null>;
}

export function OrgChartControls({
  onExportSVG,
  onExportPNG,
  onExportPDF,
  chartRef,
}: OrgChartControlsProps) {
  const handleExportSVG = () => {
    if (onExportSVG) {
      onExportSVG();
      return;
    }

    // Default SVG export
    const svgElement = chartRef?.current?.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "org-chart.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  const handleExportPNG = () => {
    if (onExportPNG) {
      onExportPNG();
      return;
    }

    // Default PNG export using canvas
    const svgElement = chartRef?.current?.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = document.createElement("img");

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement("a");
          downloadLink.href = url;
          downloadLink.download = "org-chart.png";
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(url);
        }
      });
    };

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  };

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
      return;
    }

    // PDF export would require a library like jspdf
    // For now, we'll show a message or trigger PNG export
    alert("PDF export requires additional setup. Exporting as PNG instead.");
    handleExportPNG();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportSVG}>
          <FileDown className="h-4 w-4 mr-2" />
          Export as SVG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPNG}>
          <Image className="h-4 w-4 mr-2" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

