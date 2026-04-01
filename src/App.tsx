/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FileText, FileDown, Minimize2, ArrowRightLeft, CheckCircle2, AlertCircle, Download, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import FileUploader from './components/FileUploader';
import { cn } from '@/src/lib/utils';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

type ToolType = 'pdf-to-docx' | 'docx-to-pdf' | 'compress-pdf';

interface ConversionResult {
  success: boolean;
  message: string;
  blob?: Blob;
  fileName?: string;
}

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('pdf-to-docx');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setResult(null);

    try {
      let conversionResult: ConversionResult;

      switch (activeTool) {
        case 'pdf-to-docx':
          conversionResult = await convertPdfToDocx(file);
          break;
        case 'docx-to-pdf':
          conversionResult = await convertDocxToPdf(file);
          break;
        case 'compress-pdf':
          conversionResult = await compressPdf(file);
          break;
        default:
          throw new Error('Invalid tool selected');
      }

      setResult(conversionResult);
    } catch (error) {
      console.error('Conversion error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred during conversion.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const convertPdfToDocx = async (file: File): Promise<ConversionResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const paragraphs: Paragraph[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => item.str).join(' ');
      
      if (textItems.trim()) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(textItems)],
          })
        );
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    return {
      success: true,
      message: 'Successfully converted PDF to DOCX!',
      blob,
      fileName: file.name.replace(/\.pdf$/i, '.docx')
    };
  };

  const convertDocxToPdf = async (file: File): Promise<ConversionResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    
    const doc = new jsPDF();
    const margin = 10;
    const width = doc.internal.pageSize.getWidth() - 2 * margin;
    
    // Simple text extraction for PDF if HTML rendering is too complex for basic jspdf
    const { value: text } = await mammoth.extractRawText({ arrayBuffer });
    const splitText = doc.splitTextToSize(text, width);
    doc.text(splitText, margin, 20);

    const blob = doc.output('blob');
    return {
      success: true,
      message: 'Successfully converted DOCX to PDF!',
      blob,
      fileName: file.name.replace(/\.docx$/i, '.pdf')
    };
  };

  const compressPdf = async (file: File): Promise<ConversionResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // pdf-lib's save() with compression options
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const blob = new Blob([compressedBytes], { type: 'application/pdf' });
    const originalSize = file.size;
    const newSize = blob.size;
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    return {
      success: true,
      message: `PDF compressed! Size reduced by ${reduction}%`,
      blob,
      fileName: `compressed_${file.name}`
    };
  };

  const downloadResult = () => {
    if (!result?.blob || !result?.fileName) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tools = [
    { id: 'pdf-to-docx', name: 'PDF to DOCX', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', accept: '.pdf' },
    { id: 'docx-to-pdf', name: 'DOCX to PDF', icon: FileDown, color: 'text-emerald-600', bg: 'bg-emerald-50', accept: '.docx' },
    { id: 'compress-pdf', name: 'Compress PDF', icon: Minimize2, color: 'text-purple-600', bg: 'bg-purple-50', accept: '.pdf' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">DocuShift</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Privacy</a>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Github className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight"
          >
            All-in-one Document Converter
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Fast, secure, and free. Convert your documents and optimize file sizes directly in your browser without uploading to any server.
          </motion.p>
        </div>

        {/* Tool Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                setResult(null);
              }}
              className={cn(
                "p-6 rounded-2xl border-2 transition-all duration-300 text-left group relative overflow-hidden",
                activeTool === tool.id 
                  ? "border-blue-600 bg-white shadow-lg ring-4 ring-blue-50" 
                  : "border-white bg-white hover:border-slate-200 hover:shadow-md"
              )}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", tool.bg)}>
                <tool.icon className={cn("w-6 h-6", tool.color)} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{tool.name}</h3>
              <p className="text-sm text-slate-500">
                {tool.id === 'pdf-to-docx' && 'Extract text from PDF to Word'}
                {tool.id === 'docx-to-pdf' && 'Save Word documents as PDF'}
                {tool.id === 'compress-pdf' && 'Reduce PDF file size efficiently'}
              </p>
              {activeTool === tool.id && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600"
                />
              )}
            </button>
          ))}
        </div>

        {/* Uploader Section */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl shadow-slate-200/50 border border-slate-100">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="uploader"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <FileUploader
                  onFileSelect={handleFileSelect}
                  accept={tools.find(t => t.id === activeTool)?.accept || '*'}
                  label={`Upload ${activeTool.split('-')[0].toUpperCase()} file`}
                  description={`Drag and drop or click to select a ${activeTool.split('-')[0].toUpperCase()} file`}
                  isLoading={isLoading}
                />
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center gap-6 py-8"
              >
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center",
                  result.success ? "bg-emerald-100" : "bg-rose-100"
                )}>
                  {result.success ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-10 h-10 text-rose-600" />
                  )}
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {result.success ? 'Conversion Complete!' : 'Conversion Failed'}
                  </h2>
                  <p className="text-slate-600">{result.message}</p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                  {result.success && (
                    <button
                      onClick={downloadResult}
                      className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 hover:-translate-y-0.5"
                    >
                      <Download className="w-5 h-5" />
                      Download File
                    </button>
                  )}
                  <button
                    onClick={() => setResult(null)}
                    className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                  >
                    Convert Another
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Features Section */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">100% Private</h4>
            <p className="text-slate-500 leading-relaxed">Your files never leave your browser. All processing happens locally on your machine for maximum security.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">High Quality</h4>
            <p className="text-slate-500 leading-relaxed">We use advanced algorithms to ensure text extraction and document creation maintain high fidelity.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Completely Free</h4>
            <p className="text-slate-500 leading-relaxed">No subscriptions, no limits, no watermarks. Professional document tools for everyone, forever.</p>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">DocuShift</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 DocuShift. Built with privacy in mind.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900">Terms</a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900">Privacy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
