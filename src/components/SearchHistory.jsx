import React, { useState, useEffect } from 'react';
import { Clock, Trash2, Search, Calendar } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

export default function SearchHistory({ onSelectSearch, refreshKey }) {
  const [dateFilter, setDateFilter] = useState('all');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  const searches = useLiveQuery(
    () => db.searches.orderBy('timestamp').reverse().toArray(),
    [refreshKey],
    []
  );

  const deleteSearch = async (id) => {
    try {
      await db.results.where('searchId').equals(id).delete();
      await db.summaries.where('searchId').equals(id).delete();
      await db.searches.delete(id);
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  const deleteAllSearches = async () => {
    try {
      await db.results.clear();
      await db.summaries.clear();
      await db.searches.clear();
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete all searches:', err);
    }
  };

  const filteredSearches = (searches || []).filter(s => {
    if (dateFilter === 'all') return true;
    const now = Date.now();
    const diff = now - s.timestamp;
    const dayMs = 86400000;
    if (dateFilter === 'today') return diff < dayMs;
    if (dateFilter === 'week') return diff < dayMs * 7;
    if (dateFilter === 'month') return diff < dayMs * 30;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>Search History</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Review and manage your past searches.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} color="var(--text-muted)" />
            <select
              className="select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
          {filteredSearches.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => setShowConfirmDelete('all')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            >
              <Trash2 size={14} /> Clear All
            </button>
          )}
        </div>
      </div>

      {showConfirmDelete === 'all' && (
        <div className="card" style={{ border: '1px solid var(--danger-color)', padding: '1rem' }}>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>Delete all search history? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-danger" onClick={deleteAllSearches}>Yes, Delete All</button>
            <button className="btn btn-outline" onClick={() => setShowConfirmDelete(null)}>Cancel</button>
          </div>
        </div>
      )}

      {filteredSearches.length === 0 ? (
        <div className="empty-state">
          <Clock size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h3>No search history</h3>
          <p>Start searching to build your history.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredSearches.map(search => (
            <div key={search.id} className="history-item">
              <div
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                onClick={() => onSelectSearch(search)}
              >
                <Search size={16} color="var(--primary-color)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{search.query}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                    <span>{search.engine}</span>
                    <span>{search.resultCount} results</span>
                    <span>{new Date(search.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {showConfirmDelete === search.id ? (
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button className="btn btn-danger" onClick={() => deleteSearch(search.id)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Delete
                  </button>
                  <button className="btn btn-outline" onClick={() => setShowConfirmDelete(null)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(search.id); }}
                  style={{ padding: '0.3rem' }}
                  title="Delete search"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
