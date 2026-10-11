import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Sparkles, CheckCircle2, ArrowRight, Star, Leaf, ShoppingCart, MessageSquare, AlertCircle, X, ShieldCheck, RefreshCw, Cpu, Percent, Eye } from 'lucide-react';
import { API_BASE } from '../config';

const SAMPLE_PRESETS = [
  {
    name: 'Honey Jar',
    file: 'honey.png',
    label: '🍯 Pure Honey Jar',
    desc: 'Golden honey in jar with wooden dipper (Grocery)',
    previewUrl: `${API_BASE}/static/resources/honey.png`,
  },
  {
    name: 'Rolled Oats',
    file: 'oats.png',
    label: '🌾 Rolled Oats Bowl',
    desc: 'Whole grain breakfast rolled oats bowl (Grains)',
    previewUrl: `${API_BASE}/static/resources/oats.png`,
  },
  {
    name: 'African Elephant',
    file: 'elephant.png',
    label: '🐘 African Elephant',
    desc: 'Wild animal control (Tests non-product rejection)',
    previewUrl: `${API_BASE}/static/resources/elephant.png`,
  },
];

export default function ImageSearch({
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
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

    // Atomically set upload state and reset stale vision results
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

    // Atomically set preset state and reset stale vision results
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

  // Drag and Drop
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
    setVisionResult(null); // Clear previous results while analyzing

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
      console.error('Vision analysis error:', err);
      setErrorMsg(`Visual search failed: ${err.message}. Please check if the backend is running.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      paddingBottom: 40,
    }}>
      {/* Header Info */}
      <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(0, 242, 254, 0.12)',
          border: '1px solid var(--border-mint)',
          color: 'var(--mint-cyan)',
          fontSize: '0.8rem',
          fontWeight: 700,
          marginBottom: 10,
        }}>
          <Camera size={14} /> Multi-Category Visual Product Recognition
        </div>
        <h2 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: 8, color: '#fff' }}>
          Search Catalog with a Photo
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Upload any photo (laptops, food, fresh produce, headphones). Our vision model detects object category, validates retail viability, and matches verified inventory in <code style={{ color: 'var(--mint-primary)' }}>shopai.db</code>.
        </p>
      </div>

      {/* Main Grid: Upload & Preview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
      }}>
        {/* Card 1: Upload Zone & Sample Selectors */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
            <Upload size={18} color="var(--mint-cyan)" />
            1. Upload or Select Product Image
          </h3>

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? 'var(--mint-primary)' : 'var(--border-mint)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              transition: 'all 0.2s ease',
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
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(0, 242, 254, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mint-primary)',
            }}>
              <Camera size={26} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                {isDragging ? 'Drop photo to upload' : 'Click to browse or drop any product photo'}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Supports JPEG, PNG, WebP up to 5MB
              </p>
            </div>
          </label>

          {/* Preset Buttons */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
              Or test verified reference images:
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {SAMPLE_PRESETS.map((sample) => {
                const isSelected = selectedImage?.source === 'sample' && selectedImage.sampleFilename === sample.file;
                return (
                  <button
                    key={sample.file}
                    onClick={() => handleSampleSelection(sample)}
                    style={{
                      flex: '1 1 90px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      border: isSelected ? '1px solid var(--mint-primary)' : '1px solid var(--border-subtle)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>{sample.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Selected Image Preview & Action Area */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <Sparkles size={18} color="var(--mint-cyan)" />
              2. Selected Image Preview
            </h3>
            {selectedImage && (
              <button
                onClick={handleClearSelection}
                className="btn-ghost"
                style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#94a3b8' }}
                title="Clear selected image"
              >
                <X size={14} style={{ marginRight: 4 }} /> Clear Image
              </button>
            )}
          </div>

          <div style={{
            height: 220,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-mint)',
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
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <Camera size={38} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ fontSize: '0.85rem' }}>No image selected yet</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                  Upload a photo or click a preset sample on the left
                </p>
              </div>
            )}

            {/* Dynamic Source Badge */}
            {selectedImage && (
              <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: selectedImage.source === 'upload' ? 'rgba(6, 182, 212, 0.9)' : 'rgba(0, 242, 254, 0.9)',
                color: '#04070d',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 800,
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                maxWidth: '85%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedImage.source === 'upload' ? `Uploaded: ${selectedImage.name}` : `Preset: ${selectedImage.name}`}
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#fda4af',
              fontSize: '0.82rem',
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={runVisionSearch}
            disabled={!selectedImage || isAnalyzing}
            className="btn-primary"
            style={{
              padding: '14px 20px',
              fontSize: '1rem',
              opacity: !selectedImage || isAnalyzing ? 0.5 : 1,
              cursor: !selectedImage || isAnalyzing ? 'not-allowed' : 'pointer',
            }}
          >
            {isAnalyzing ? (
              <>
                <span className="typing-dot" />
                <span style={{ marginLeft: 8 }}>Analyzing with Qwen Vision AI...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Analyze & Find Products in Store</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Vision Analysis Findings & Matched Catalog Products */}
      {visionResult && (
        <div className="glass-panel animate-slide-up" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section 1: AI Model Detection Findings (Distinct from Inventory) */}
          <div style={{
            background: 'rgba(0, 242, 254, 0.06)',
            border: '1px solid var(--border-mint)',
            borderRadius: 'var(--radius-md)',
            padding: 22,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={24} color="var(--mint-primary)" />
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  AI Visual Recognition Result
                </h4>
              </div>
              <span style={{
                fontSize: '0.72rem',
                color: 'var(--mint-cyan)',
                background: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid var(--border-mint)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
              }}>
                Status: {visionResult.status?.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 12,
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Identified Item / Object</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>
                  {visionResult.detected?.predicted_label || 'Detected Item'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retail Viability</span>
                <div style={{ marginTop: 2 }}>
                  {visionResult.detected?.is_product_for_sale ? (
                    <span style={{ color: 'var(--mint-cyan)', fontSize: '0.85rem', fontWeight: 700 }}>
                      ✓ Retail Product for Sale
                    </span>
                  ) : (
                    <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
                      ⚠️ Non-Retail / Living Entity
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model Confidence</span>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.round((visionResult.detected?.confidence || 0.85) * 100)}%`,
                      height: '100%',
                      background: 'var(--mint-gradient)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--mint-light)' }}>
                    {Math.round((visionResult.detected?.confidence || 0.85) * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Identified Category</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--mint-cyan)', marginTop: 2 }}>
                  {visionResult.detected?.category || 'General'}
                </p>
              </div>
            </div>

            {visionResult.guidance_message && (
              <p style={{
                fontSize: '0.88rem',
                color: 'var(--text-secondary)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: 12,
                marginTop: 8,
                lineHeight: 1.5,
              }}>
                <strong>Agent Guidance:</strong> {visionResult.guidance_message}
              </p>
            )}
          </div>

          {/* Section 2: Store Catalog Matches (Real Database Items Only) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                Store Catalog Matches ({visionResult.total_matches || 0})
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Verified inventory from <code style={{ color: 'var(--mint-primary)' }}>shopai.db</code>
              </span>
            </div>

            {visionResult.matched_products && visionResult.matched_products.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
              }}>
                {visionResult.matched_products.map((item) => (
                  <div
                    key={item.id}
                    className="glass-panel"
                    style={{
                      border: '1px solid var(--border-mint)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ height: 140, position: 'relative', overflow: 'hidden', background: '#000' }}>
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Match Score Badge */}
                      <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        <span className="badge-mint">
                          {item.match_percentage || 90}% Match
                        </span>
                      </div>
                      <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                        <span className="badge-rating">
                          <Star size={11} fill="#f59e0b" color="#f59e0b" />
                          {item.rating ? item.rating.toFixed(1) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--mint-cyan)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {item.brand || 'Store'} • {item.category}
                      </div>

                      <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                        {item.name}
                      </h5>

                      <p style={{
                        fontSize: '0.78rem',
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
                        paddingTop: 8,
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--mint-primary)' }}>
                          {formatPrice(item.price, item.price_inr)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {item.stock > 10 ? 'In Stock' : 'Limited'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => onAddToCart(item)}
                          className="btn-secondary"
                          style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem' }}
                        >
                          <ShoppingCart size={13} /> + Cart
                        </button>
                        <button
                          onClick={() => onAskInChat(`Tell me about ${item.name} (ID: #${item.id})`)}
                          className="btn-primary"
                          style={{ flex: 1.2, padding: '8px 10px', fontSize: '0.78rem' }}
                        >
                          <MessageSquare size={13} /> Ask AI
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Honest Zero-Match State */
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed var(--border-mint)',
                borderRadius: 'var(--radius-md)',
                padding: '36px 20px',
                textAlign: 'center',
              }}>
                {visionResult.status === 'non_product_item' ? (
                  <>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
                    <h5 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
                      Non-Product Entity Detected: "{visionResult.detected?.predicted_label}"
                    </h5>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto' }}>
                      ShopAI is an e-commerce retail platform. We do not sell live animals, pets, or non-retail items. Zero catalog matches returned.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                    <h5 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                      No Store Catalog Items Match "{visionResult.detected?.predicted_label}"
                    </h5>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto' }}>
                      Our vision model recognized the image as <strong>"{visionResult.detected?.predicted_label}"</strong>. However, this specific item is not currently listed in our store catalog. We do not substitute unrelated items.
                    </p>
                    <button
                      onClick={() => onAskInChat(`Do you have any alternatives for ${visionResult.detected?.predicted_label}?`)}
                      className="btn-secondary"
                      style={{ marginTop: 14 }}
                    >
                      Ask AI Assistant for catalog alternatives
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
