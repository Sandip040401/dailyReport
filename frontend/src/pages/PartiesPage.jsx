// src/pages/PartiesPage.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { partyAPI } from '../lib/api';

export default function PartiesPage() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [alert, setAlert] = useState(null);

  const [formData, setFormData] = useState({
    partyName: '',
    partyCode: '',
    partyType: ''
  });

  useEffect(() => {
    fetchParties();
  }, []);

  // Auto-dismiss alert after 3 seconds
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
  };

  const fetchParties = async () => {
    try {
      setLoading(true);
      const response = await partyAPI.getAllParties();
      setParties(response.data);
    } catch (error) {
      console.error('Error fetching parties:', error);
      showAlert('Failed to load parties', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'partyCode' ? value.toUpperCase() : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.partyName || !formData.partyCode || !formData.partyType) {
      showAlert('Please fill in all required fields', 'error');
      return;
    }
    try {
      setLoading(true);
      if (editingId) {
        await partyAPI.updateParty(editingId, formData);
        showAlert('Party updated successfully', 'success');
      } else {
        await partyAPI.createParty(formData);
        showAlert('Party created successfully', 'success');
      }
      fetchParties();
      setShowModal(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error('Error saving party:', error);
      showAlert(error.message || 'Failed to save party', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      partyName: '',
      partyCode: '',
      partyType: ''
    });
  };

  const handleEdit = (party) => {
    setEditingId(party._id);
    setFormData({
      partyName: party.partyName,
      partyCode: party.partyCode,
      partyType: party.partyType
    });
    setShowModal(true);
  };

  const handleDeactivate = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this party?')) {
      try {
        setLoading(true);
        await partyAPI.deactivateParty(id);
        showAlert('Party deactivated successfully', 'success');
        fetchParties();
      } catch (error) {
        console.error('Error deactivating party:', error);
        showAlert('Failed to deactivate party', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Alert Container - Fixed on right side */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
        {alert && (
          <div
            className={`flex items-start p-4 rounded-lg shadow-lg border animate-slide-in-right ${
              alert.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex-shrink-0">
              {alert.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <p
                className={`text-sm font-medium ${
                  alert.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {alert.message}
              </p>
            </div>
            <button
              onClick={() => setAlert(null)}
              className={`ml-3 flex-shrink-0 ${
                alert.type === 'success'
                  ? 'text-green-600 hover:text-green-800'
                  : 'text-red-600 hover:text-red-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Global Loader Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-8 shadow-2xl">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
              <p className="text-gray-700 font-medium">Processing...</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black">Parties</h1>
              <p className="text-sm text-gray-600">Manage all parties</p>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                resetForm();
                setShowModal(true);
              }}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              <span>Add Party</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {parties.length === 0 && !loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-4">No parties found</p>
              <button
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                  setShowModal(true);
                }}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Party</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-black">Party Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-black">Party Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-black">Party Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parties.map(party => (
                    <tr key={party._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-black">{party.partyName}</td>
                      <td className="px-6 py-4 text-sm text-black">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono font-medium border border-gray-300">
                          {party.partyCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-black">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${
                          party.partyType === 'daily'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {party.partyType === 'daily' ? 'Daily Party' : 'Multiday Party'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(party)}
                          disabled={loading}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {party.isActive && (
                          <button
                            onClick={() => handleDeactivate(party._id)}
                            disabled={loading}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full border border-gray-300 shadow-xl">
            <div className="border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-black">
                {editingId ? 'Edit Party' : 'Add Party'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="text-gray-600 hover:text-black text-2xl disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Party Name *</label>
                <input
                  type="text"
                  name="partyName"
                  value={formData.partyName}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="e.g., ABC Traders"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Party Code *</label>
                <input
                  type="text"
                  name="partyCode"
                  value={formData.partyCode}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="e.g., BD, JR"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500 uppercase disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Party Type *</label>
                <select
                  name="partyType"
                  value={formData.partyType}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">Select party type</option>
                  <option value="daily">Daily Party</option>
                  <option value="multiday">Multiday Party</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-black rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
