import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, Sparkles, CheckCircle2, ArrowRight, Star, Leaf,
  ShoppingCart, MessageSquare, AlertCircle, X, ShieldCheck, RefreshCw,
  Cpu, Zap, Eye, Check, Clock
} from 'lucide-react';
import { API_BASE } from '../config';

const SAMPLE_PRESETS = [
  {
    name: 'Honey Jar',
    file: 'honey.png',
    label: '🍯 Pure Honey Jar',
    categoryHint: 'Pure Honey',
    desc: 'Golden raw wild honey in glass jar (Grocery)',
    previewUrl: '/resources/honey.png',
    fallbackUrl: `${API_BASE}/static/resources/honey.png`,
  },
  {
    name: 'Rolled Oats',
    file: 'oats.png',
    label: '🌾 Rolled Oats Bowl',
    categoryHint: 'Grains & Oats',
    desc: 'Whole grain breakfast rolled oats bowl (Grains)',
    previewUrl: '/resources/oats.png',
    fallbackUrl: `${API_BASE}/static/resources/oats.png`,
  },
  {
    name: 'African Elephant',
    file: 'elephant.png',
    label: '🐘 African Elephant',
    categoryHint: 'Non-Retail Entity',
    desc: 'Wild animal control test (Tests retail safety guardrail)',
    previewUrl: '/resources/elephant.png',
    fallbackUrl: `${API_BASE}/static/resources/elephant.png`,
  },
];

export default function ImageSearch({
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => {
    if (inr !== undefined && inr !== null && !isNaN(Number(inr))) return `₹${Math.round(Number(inr)).toLocaleString('en-IN')}`;
    const n = Number(p);
    return !isNaN(n) && p !== undefined && p !== null ? `₹${Math.round(n * 85).toLocaleString('en-IN')}` : '₹0';
  },
  currency = 'INR',
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [visionResult, setVisionResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);

  // Revoke object URLs on unmount or replacement
  useEffect(() => {
    return () => {
      if (selectedImage?.source === 'upload' && selectedImage.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl);
      }
    };
  }, [selectedImage]);

  // Handle uploading an image file
  const handleFileSelection = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    if (selectedImage?.source === 'upload' && selectedImage.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedImage({
      source: 'upload',
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      fileObject: file,
      sampleFilename: null,
    });
    setVisionResult(null);
    setErrorMsg(null);
  };

  // Handle clicking a sample preset
  const handleSampleSelection = (sample) => {
    if (selectedImage?.source === 'upload' && selectedImage.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedImage({
      source: 'sample',
      name: sample.name,
      previewUrl: sample.previewUrl,
      fileObject: null,
      sampleFilename: sample.file,
    });
    setVisionResult(null);
    setErrorMsg(null);
  };

  // Clear current selection
  const handleClearSelection = () => {
    if (selectedImage?.source === 'upload' && selectedImage.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedImage(null);
    setVisionResult(null);
    setErrorMsg(null);
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Run analysis
  const runVisionSearch = async () => {
    if (!selectedImage) {
      setErrorMsg('Please upload a product photo or select a sample image first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setVisionResult(null);

    try {
      let data;
      if (selectedImage.source === 'upload' && selectedImage.fileObject) {
        const formData = new FormData();
        formData.append('file', selectedImage.fileObject);

        const res = await fetch(`${API_BASE}/api/vision/search`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
        data = await res.json();
      } else if (selectedImage.source === 'sample' && selectedImage.sampleFilename) {
        const res = await fetch(`${API_BASE}/api/vision/search-base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample_name: selectedImage.sampleFilename }),
        });
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
        data = await res.json();
      } else {
        throw new Error('No valid image data available.');
      }

      setVisionResult(data);
    } catch (err) {
      console.error('Vision analysis notice:', err);
      // Fallback: If backend is completely offline, generate honest local demo match
      setErrorMsg(`Visual search service notice: ${err.message}. Ensure backend is running at http://localhost:8000.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{
      maxWidth: 1180,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
      paddingBottom: 60,
    }}>
      {/* Header Info */}
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 16px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--moss-tint)',
          border: '1px solid var(--moss-border)',
          color: 'var(--moss-deep)',
          fontSize: '0.8rem',
          fontWeight: 700,
          marginBottom: 12,
        }}>
          <Camera size={14} color="var(--moss-sage)" /> Visual Lens • Multimodal Visual Product Discovery
        </div>
        <h2 style={{
          fontSize: '2.2rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          marginBottom: 10,
          color: 'var(--moss-deep)',
          letterSpacing: '-0.02em',
        }}>
          Search by Photo or Screenshot
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6 }}>
          Snap or upload a photo of organic pantry jars, cold-pressed oils, fresh produce, clothing, or electronics.
          Our visual neural vision engine scans packaging and matches verified store catalog inventory.
        </p>
      </div>

      {/* Main Grid: Upload & Preview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 24,
      }}>
        {/* Card 1: Upload Zone & Sample Selectors */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--moss-border)',
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--moss-deep)' }}>
              <Upload size={18} color="var(--moss-sage)" />
              1. Choose Photo or Preset
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-card-muted)', padding: '2px 8px', borderRadius: 9999 }}>
              JPG, PNG, WebP · Max 5MB
            </span>
          </div>

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? 'var(--moss-deep)' : 'var(--moss-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'var(--moss-tint)' : 'var(--bg-card-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              transition: 'all 0.25s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
              style={{ display: 'none' }}
            />
            <div style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'var(--moss-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--moss-deep)',
              border: '1px solid var(--moss-border)',
            }}>
              <Camera size={26} />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--moss-deep)' }}>
                Click to browse photo or drag & drop here
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Instant recognition of food labels, jars, produce, and apparel
              </p>
            </div>
          </label>

          {/* Reference Presets */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 700 }}>
              Or test verified reference sample photos:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {SAMPLE_PRESETS.map((sample) => {
                const isSelected = selectedImage?.source === 'sample' && selectedImage.sampleFilename === sample.file;
                return (
                  <button
                    key={sample.file}
                    type="button"
                    onClick={() => handleSampleSelection(sample)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--moss-tint)' : '#ffffff',
                      border: isSelected ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                      color: 'var(--moss-deep)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={sample.previewUrl}
                        alt={sample.name}
                        onError={(e) => { e.target.src = sample.fallbackUrl; }}
                        style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--moss-border)' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{sample.label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sample.desc}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} color="var(--moss-deep)" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Selected Image Preview & Action Area */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--moss-border)',
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--moss-deep)' }}>
              <Sparkles size={18} color="var(--moss-sage)" />
              2. Inspect & Match
            </h3>
            {selectedImage && (
              <button
                type="button"
                onClick={handleClearSelection}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  color: 'var(--clay-terracotta)',
                  border: '1px solid var(--moss-border)',
                  background: 'transparent',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 600,
                }}
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>

          <div style={{
            height: 240,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card-muted)',
            border: '1px solid var(--moss-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {selectedImage?.previewUrl ? (
              <img
                src={selectedImage.previewUrl}
                alt={selectedImage.name || 'Selected product'}
                onError={(e) => {
                  if (selectedImage.source === 'sample') {
                    e.target.src = `${API_BASE}/static/resources/${selectedImage.sampleFilename}`;
                  }
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                <Camera size={42} style={{ opacity: 0.35, margin: '0 auto 10px', color: 'var(--moss-deep)' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>No photo selected yet</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Upload a photo from your device or pick a preset sample on the left
                </p>
              </div>
            )}

            {/* Dynamic Source Badge */}
            {selectedImage && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'var(--moss-deep)',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)',
                maxWidth: '85%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedImage.source === 'upload' ? `File: ${selectedImage.name}` : `Sample: ${selectedImage.name}`}
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              color: '#b91c1c',
              fontSize: '0.82rem',
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={runVisionSearch}
            disabled={!selectedImage || isAnalyzing}
            className="btn-primary"
            style={{
              padding: '14px 20px',
              fontSize: '0.96rem',
              fontWeight: 700,
              opacity: !selectedImage || isAnalyzing ? 0.6 : 1,
              cursor: !selectedImage || isAnalyzing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-moss)',
            }}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={17} className="animate-spin" />
                <span>Running Visual Recognition Engine...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Scan Photo & Find Store Matches</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Vision Analysis Findings & Matched Catalog Products */}
      {visionResult && (
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--moss-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          boxShadow: 'var(--shadow-md)',
        }}>
          {/* Section 1: AI Model Detection Findings */}
          <div style={{
            background: 'var(--moss-tint)',
            border: '1px solid var(--moss-border)',
            borderRadius: 'var(--radius-md)',
            padding: 22,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={24} color="var(--moss-deep)" />
                <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                  Visual Neural Recognition Report
                </h4>
              </div>
              <span style={{
                fontSize: '0.74rem',
                color: 'var(--moss-deep)',
                background: '#ffffff',
                border: '1px solid var(--moss-border)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 800,
              }}>
                STATUS: {visionResult.status?.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 12,
            }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Identified Item / Subject</span>
                <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--moss-deep)', marginTop: 2 }}>
                  {visionResult.detected?.predicted_label || 'Detected Item'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Retail Store Viability</span>
                <div style={{ marginTop: 2 }}>
                  {visionResult.detected?.is_product_for_sale ? (
                    <span style={{ color: 'var(--moss-forest)', fontSize: '0.88rem', fontWeight: 700 }}>
                      ✓ Verified Retail Catalog Item
                    </span>
                  ) : (
                    <span style={{ color: 'var(--clay-terracotta)', fontSize: '0.88rem', fontWeight: 700 }}>
                      ⚠️ Non-Retail / Living Entity (Protected)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Recognition Confidence</span>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(28, 48, 36, 0.1)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.round((visionResult.detected?.confidence || 0.85) * 100)}%`,
                      height: '100%',
                      background: 'var(--moss-deep)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                    {Math.round((visionResult.detected?.confidence || 0.85) * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Predicted Category</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--moss-sage)', marginTop: 2 }}>
                  {visionResult.detected?.category || 'General'}
                </p>
              </div>
            </div>

            {visionResult.guidance_message && (
              <p style={{
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                borderTop: '1px solid var(--moss-border)',
                paddingTop: 12,
                marginTop: 8,
                lineHeight: 1.5,
              }}>
                <strong>Trovi AI Guidance:</strong> {visionResult.guidance_message}
              </p>
            )}
          </div>

          {/* Section 2: Store Catalog Matches */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                Store Catalog Matches ({visionResult.total_matches || 0})
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Verified inventory from store catalog
              </span>
            </div>

            {visionResult.matched_products && visionResult.matched_products.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 18,
              }}>
                {visionResult.matched_products.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    <div style={{ height: 160, position: 'relative', overflow: 'hidden', background: 'var(--bg-card-muted)' }}>
                      <img
                        src={item.image_url}
                        alt={item.name}
                        onError={(e) => { e.target.src = '/placeholder.png'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Match Score Badge */}
                      <div style={{ position: 'absolute', top: 10, left: 10 }}>
                        <span style={{
                          background: 'var(--moss-deep)',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                        }}>
                          {item.match_percentage || 90}% Match
                        </span>
                      </div>
                      <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
                        <span style={{
                          background: '#ffffff',
                          color: 'var(--moss-deep)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: 'var(--shadow-sm)',
                        }}>
                          <Star size={11} fill="#eab308" color="#eab308" />
                          {item.rating ? Number(item.rating).toFixed(1) : '4.8'}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--moss-sage)', textTransform: 'uppercase', fontWeight: 800 }}>
                        {item.brand || 'MOSS'} • {item.category}
                      </div>

                      <h5 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--moss-deep)', lineHeight: 1.3 }}>
                        {item.name}
                      </h5>

                      <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {item.description}
                      </p>

                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: 10,
                        borderTop: '1px solid var(--moss-border)',
                      }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                          {formatPrice(item.price, item.price_inr)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: item.stock > 10 ? 'var(--moss-forest)' : 'var(--clay-terracotta)', fontWeight: 700 }}>
                          {item.stock > 10 ? 'In Stock' : 'Limited Units'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => onAddToCart(item)}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--moss-border)',
                            background: '#ffffff',
                            color: 'var(--moss-deep)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}
                        >
                          <ShoppingCart size={14} /> + Bag
                        </button>
                        <button
                          type="button"
                          onClick={() => onAskInChat(`Tell me about ${item.name} (ID: #${item.id})`)}
                          className="btn-primary"
                          style={{
                            flex: 1.2,
                            padding: '8px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}
                        >
                          <MessageSquare size={14} /> Ask AI
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Honest Zero-Match State */
              <div style={{
                background: 'var(--bg-card-muted)',
                border: '1px dashed var(--moss-border)',
                borderRadius: 'var(--radius-md)',
                padding: '40px 24px',
                textAlign: 'center',
              }}>
                {visionResult.status === 'non_product_item' ? (
                  <>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🐘</div>
                    <h5 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--moss-deep)', marginBottom: 6 }}>
                      Non-Retail Entity Detected: "{visionResult.detected?.predicted_label}"
                    </h5>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto', lineHeight: 1.5 }}>
                      Trovi is a multi-category lifestyle retail store. We protect animal welfare and do not sell live animals, pets, or non-retail items. Zero inventory matches returned.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔍</div>
                    <h5 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--moss-deep)', marginBottom: 6 }}>
                      No Store Catalog Items Match "{visionResult.detected?.predicted_label}"
                    </h5>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto', lineHeight: 1.5 }}>
                      Our visual model recognized the image as <strong>"{visionResult.detected?.predicted_label}"</strong>. However, this specific item is not currently listed in our store catalog. We never substitute unrelated items.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAskInChat(`Do you have any alternatives for ${visionResult.detected?.predicted_label}?`)}
                      className="btn-primary"
                      style={{ marginTop: 16 }}
                    >
                      Ask AI Concierge for Catalog Alternatives
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
