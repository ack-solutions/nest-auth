import React, { useState, useEffect, useCallback } from 'react';
import { Ban, Plus, Trash2, DownloadCloud } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/use-confirm';
import type { BlockedDomain } from '../types';
import { PageHeader } from '../components/page-header';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { Table, Column, PaginationInfo } from '../components/table';

export const BlockedDomainsPage: React.FC = () => {
    const [domains, setDomains] = useState<BlockedDomain[]>([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState<{ count: number; defaultCount: number }>({ count: 0, defaultCount: 0 });
    const [addOpen, setAddOpen] = useState(false);
    const [addValue, setAddValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const confirm = useConfirm();

    const loadStats = useCallback(async () => {
        try {
            const s = await api.get<{ count: number; defaultCount: number }>('/api/blocked-email-domains/stats');
            setStats(s);
        } catch {
            /* non-fatal */
        }
    }, []);

    const loadDomains = useCallback(async () => {
        try {
            setError('');
            setLoading(true);
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            params.append('page', String(pagination.page));
            params.append('pageSize', String(pagination.limit));
            const res = await api.get<{ data: BlockedDomain[]; total: number }>(
                `/api/blocked-email-domains?${params.toString()}`,
            );
            setDomains(Array.isArray(res.data) ? res.data : []);
            setPagination((prev) => ({
                ...prev,
                total: res.total ?? 0,
                totalPages: Math.max(1, Math.ceil((res.total ?? 0) / prev.limit)),
            }));
        } catch (err: any) {
            setError(err.message || 'Failed to load blocked domains');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, pagination.page, pagination.limit]);

    useEffect(() => { loadDomains(); }, [loadDomains]);
    useEffect(() => { loadStats(); }, [loadStats]);

    useEffect(() => {
        const id = window.setTimeout(() => {
            setSearchTerm(searchInput);
            setPagination((prev) => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    const handleAdd = async () => {
        const list = addValue.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean);
        if (!list.length) return;
        setSaving(true);
        try {
            const res = await api.post<{ added: number; skipped: number }>('/api/blocked-email-domains', { domains: list });
            setAddOpen(false);
            setAddValue('');
            setNotice(`Added ${res.added} domain(s)${res.skipped ? `, ${res.skipped} already present` : ''}.`);
            await loadDomains();
            await loadStats();
        } catch (err: any) {
            setError(err.message || 'Failed to add domains');
        } finally {
            setSaving(false);
        }
    };

    const handleImportDefaults = async () => {
        const ok = await confirm(
            `Import the built-in default list (${stats.defaultCount.toLocaleString()} domains)? Existing entries are skipped.`,
        );
        if (!ok) return;
        setLoading(true);
        try {
            const res = await api.post<{ imported: number; total: number }>('/api/blocked-email-domains/import-defaults', {});
            setNotice(`Imported ${res.imported.toLocaleString()} domain(s). Total blocked: ${res.total.toLocaleString()}.`);
            await loadDomains();
            await loadStats();
        } catch (err: any) {
            setError(err.message || 'Failed to import the default list');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (row: BlockedDomain) => {
        const ok = await confirm(`Remove "${row.domain}" from the blocklist?`);
        if (!ok) return;
        try {
            await api.delete(`/api/blocked-email-domains/${encodeURIComponent(row.id || row.domain)}`);
            await loadDomains();
            await loadStats();
        } catch (err: any) {
            setError(err.message || 'Failed to remove the domain');
        }
    };

    const handlePageChange = (newPage: number) => setPagination((prev) => ({ ...prev, page: newPage }));

    const columns: Column<BlockedDomain>[] = [
        {
            key: 'domain',
            label: 'Domain',
            render: (d) => (
                <Typography variant="body2" fontWeight="medium" color="text.primary">{d.domain}</Typography>
            ),
        },
        {
            key: 'source',
            label: 'Source',
            render: (d) => (
                <Chip
                    size="small"
                    label={d.source || 'manual'}
                    variant="outlined"
                    color={d.source === 'default' ? 'default' : 'primary'}
                    sx={{ height: 24 }}
                />
            ),
        },
        {
            key: 'createdAt',
            label: 'Added',
            render: (d) => (
                <Typography variant="body2" color="text.secondary">
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                </Typography>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (d) => (
                <Stack direction="row" justifyContent="flex-end">
                    <IconButton size="small" color="error" onClick={() => handleDelete(d)} aria-label="Remove domain">
                        <Icon component={Trash2} />
                    </IconButton>
                </Stack>
            ),
        },
    ];

    return (
        <Stack spacing={3}>
            <PageHeader
                title="Blocked Email Domains"
                description={`Reject sign-ups from these disposable / blocked domains. ${stats.count.toLocaleString()} blocked.`}
                onRefresh={loadDomains}
                loading={loading}
                action={
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" color="primary" onClick={handleImportDefaults} startIcon={<Icon component={DownloadCloud} />}>
                            Import defaults
                        </Button>
                        <Button variant="contained" color="primary" onClick={() => setAddOpen(true)} startIcon={<Icon component={Plus} />}>
                            Add domains
                        </Button>
                    </Stack>
                }
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
                <TextField
                    fullWidth
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search domains..."
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchInput ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearchInput('')} aria-label="Clear search">
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    }}
                />
            </Paper>

            {notice && (<Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>)}
            {error && (<Alert severity="error" onClose={() => setError('')}>{error}</Alert>)}

            <Table
                columns={columns}
                data={domains}
                loading={loading}
                emptyMessage={stats.count === 0 ? 'No blocked domains yet — add some, or import the default list.' : 'No domains match your search'}
                emptyIcon={<Icon component={Ban} sx={{ fontSize: 64, color: 'action.disabled' }} />}
                pagination={pagination}
                onPageChange={handlePageChange}
                rowKey={(d) => d.id || d.domain}
            />

            <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add blocked domains</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Enter one or more email domains (e.g. <code>mailinator.com</code>), separated by new lines, commas, or spaces.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={4}
                        value={addValue}
                        onChange={(e) => setAddValue(e.target.value)}
                        placeholder={'mailinator.com\nguerrillamail.com'}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleAdd} variant="contained" disabled={saving || !addValue.trim()}>Add</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};
