import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReports, fetchReportPdf, setSelectedReport } from '../store/dash/reports';
import { setPdfUrl, setTextractBlocks } from '../store/dash/pdfViewer';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';

export default function ViewReports() {
    const dispatch = useDispatch();
    const { reports, loading, error, selectedReport, loadingPdf } = useSelector(state => state.reports);
    
    // Fetch reports on component mount
    useEffect(() => {
        // Clear textract blocks when viewing reports (no bounding boxes needed)
        dispatch(setTextractBlocks(null));
        
        const bucket = import.meta.env.VITE_AWS_S3_BUCKET;
        if (bucket) {
            dispatch(fetchReports(bucket));
        }
    }, [dispatch]);

    const handleReportChange = async (e) => {
        const reportKey = e.target.value;
        
        // Update Redux with the selected report
        dispatch(setSelectedReport(reportKey || null));
        
        // If a report is selected, load its PDF
        if (reportKey) {
            const report = reports.find(r => r.key === reportKey);
            if (report) {
                try {
                    const pdfUrl = await dispatch(fetchReportPdf(reportKey, report.fileName));
                    dispatch(setPdfUrl(pdfUrl));
                } catch (err) {
                    console.error('Error loading report PDF:', err);
                }
            }
        }
    };

    const handleRefreshReports = () => {
        const bucket = import.meta.env.VITE_AWS_S3_BUCKET;
        if (bucket) {
            dispatch(fetchReports(bucket, true)); // Force refresh
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-theme-primary">View Reports</h2>
            
            <div>
                <label
                    htmlFor="report-select"
                    className="block text-sm font-medium text-theme-primary mb-2"
                >
                    <div className="flex items-center space-x-2">
                        <span>Select a Report</span>
                        {loading && <LoadingSpinner size="small" text="Loading..." />}
                        {loadingPdf && <LoadingSpinner size="small" text="Loading PDF..." />}
                    </div>
                </label>
                <div className="flex space-x-2">
                    <select
                        id="report-select"
                        name="report"
                        value={selectedReport || ''}
                        onChange={handleReportChange}
                        className="flex-1 px-3 py-2 border border-theme-primary rounded-md bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                        disabled={loading}
                    >
                        <option value="">
                            {loading ? 'Loading reports...' : error ? 'Error loading reports' : reports.length === 0 ? 'No reports found' : 'Choose a report...'}
                        </option>
                        {reports.map((report) => (
                            <option key={report.key} value={report.key}>
                                {report.fileName}
                            </option>
                        ))}
                    </select>
                    {loading ? (
                        <div className="flex items-center px-3">
                            <LoadingSpinner size="small" />
                        </div>
                    ) : (
                        <Button
                            displayText="↻"
                            onClick={handleRefreshReports}
                            variant="ghost"
                            size="small"
                            type="button"
                            title="Refresh reports"
                        />
                    )}
                </div>
                {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                )}
            </div>
        </div>
    );
}
