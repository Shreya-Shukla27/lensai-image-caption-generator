import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

export default function UploadZone({ onFileSelect, preview }) {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
    setDragActive(false);
  }, [onFileSelect]);

  const onDropRejected = useCallback((fileRejections) => {
    const firstRejection = fileRejections[0];
    if (!firstRejection) {
      return;
    }

    const errorCodes = firstRejection.errors.map((err) => err.code);
    if (errorCodes.includes('file-too-large')) {
      toast.error('File too large. Max size is 5MB.');
    } else if (errorCodes.includes('file-invalid-type')) {
      toast.error('Only JPG, PNG, and WEBP are allowed.');
    } else {
      toast.error('Could not upload this file.');
    }

    setDragActive(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  if (preview) {
    return (
      <div className="relative group rounded-2xl overflow-hidden border border-border">
        <img
          src={preview}
          alt="Preview"
          className="w-full max-h-80 object-cover"
        />
        <div
          {...getRootProps({
            'aria-label': 'Change uploaded image',
          })}
          className="absolute inset-0 bg-ink/70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <input {...getInputProps({ 'aria-label': 'Choose a new image file' })} />
          <p className="text-white font-body text-sm">Tap or click to change image</p>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps({
        'aria-label': 'Upload image for caption generation',
      })}
      className={`
        relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
        flex flex-col items-center justify-center p-8 sm:p-16 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70
        ${isDragActive || dragActive
          ? 'border-accent bg-accent/5 glow'
          : 'border-border hover:border-accent/50 hover:bg-panel/50'
        }
      `}
    >
      <input {...getInputProps({ 'aria-label': 'Choose an image file' })} />

      <div className={`mb-4 transition-transform duration-200 ${isDragActive ? 'scale-110' : ''}`}>
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-panel border border-border flex items-center justify-center mx-auto mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent sm:w-7 sm:h-7">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <p className="font-display font-600 text-base sm:text-lg text-white mb-2">
        {isDragActive ? 'Drop it here' : 'Drop your image here'}
      </p>
      <p className="text-muted font-body text-xs sm:text-sm mb-4">
        or click to browse files
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted font-mono">
        <span className="px-2 py-1 bg-panel rounded border border-border">JPG</span>
        <span className="px-2 py-1 bg-panel rounded border border-border">PNG</span>
        <span className="px-2 py-1 bg-panel rounded border border-border">WEBP</span>
        <span className="text-muted">· max 5MB</span>
      </div>
    </div>
  );
}
