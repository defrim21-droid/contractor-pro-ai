import React, { useState, useMemo } from 'react';
import { TrashIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function ProjectsHub({
  projects,
  onNewProject,
  onOpenProject,
  onDeleteProjects,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjects, setSelectedProjects] = useState(new Set());

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (project) =>
        project.name?.toLowerCase().includes(query) ||
        project.address?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleToggleSelect = (projectId, e) => {
    e.stopPropagation();
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map((p) => p.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedProjects.size === 0) return;
    onDeleteProjects(Array.from(selectedProjects));
    setSelectedProjects(new Set());
  };

  const handleProjectClick = (project) => {
    // Only open project if not in selection mode or if clicking on the card (not checkbox)
    if (selectedProjects.size === 0) {
      onOpenProject(project);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Projects</h1>
        <div className="flex gap-3">
          {selectedProjects.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="bg-red-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-700 shadow-medium hover:shadow-large transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <TrashIcon className="h-5 w-5 inline mr-1" />
              Delete ({selectedProjects.size})
            </button>
          )}
          <button
            type="button"
            onClick={onNewProject}
            className="btn-primary px-6 py-3"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects by name or address..."
          className="input-modern"
        />
      </div>

      {/* Select All / Results Count */}
      {filteredProjects.length > 0 && (
        <div className="flex justify-between items-center mb-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={
                filteredProjects.length > 0 &&
                selectedProjects.size === filteredProjects.length
              }
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span>
              Select all ({filteredProjects.length} project
              {filteredProjects.length !== 1 ? 's' : ''})
            </span>
          </label>
          {searchQuery && (
            <p className="text-sm text-slate-500">
              {filteredProjects.length} result{filteredProjects.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 text-lg">
            {searchQuery
              ? 'No projects found matching your search.'
              : 'No projects yet. Create your first project!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => {
            const isSelected = selectedProjects.has(project.id);
            return (
              <div
                key={project.id}
                className={`card-modern overflow-hidden relative ${
                  isSelected
                    ? 'border-blue-500 shadow-glow scale-[1.02]'
                    : ''
                }`}
              >
                {/* Checkbox */}
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleToggleSelect(project.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Project Card */}
                <button
                  type="button"
                  onClick={() => handleProjectClick(project)}
                  className="w-full text-left"
                >
                  <div className="h-48 bg-slate-200 relative">
                    <img
                      src={project.original_image_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <div className="p-5">
                    <div className="font-bold text-slate-900">{project.name}</div>
                    {project.address && (
                      <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <MapPinIcon className="h-4 w-4" />
                        {project.address}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

