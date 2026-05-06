using System;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using Sentinel.Shared;
using Sentinel.Uploader;

namespace SentinelAgent;

public class TrayApp : ApplicationContext
{
    private readonly NotifyIcon _trayIcon;
    private readonly ContextMenuStrip _contextMenu;
    private readonly ToolStripMenuItem _pauseMenuItem;

    public TrayApp()
    {
        _pauseMenuItem = new ToolStripMenuItem("Pause monitoring", null, Pause_Click);
        _pauseMenuItem.Checked = RegistryState.Paused;

        _contextMenu = new ContextMenuStrip();
        _contextMenu.Items.Add("Run now", null, RunNow_Click);
        _contextMenu.Items.Add("View latest report", null, ViewLatest_Click);
        _contextMenu.Items.Add(_pauseMenuItem);
        _contextMenu.Items.Add(new ToolStripSeparator());
        _contextMenu.Items.Add("Uninstall", null, Uninstall_Click);

        _trayIcon = new NotifyIcon
        {
            Icon = SystemIcons.Shield,
            ContextMenuStrip = _contextMenu,
            Visible = true,
            Text = "Sentinel Agent"
        };
    }

    private async void RunNow_Click(object? sender, EventArgs e)
    {
        if (RegistryState.Paused) return;

        try
        {
            _trayIcon.Text = "Sentinel Agent (Running...)";
            await Program.RunCollectionAsync(showNotification: true, trayIcon: _trayIcon);
        }
        finally
        {
            _trayIcon.Text = "Sentinel Agent";
        }
    }

    private void ViewLatest_Click(object? sender, EventArgs e)
    {
        var id = RegistryState.LastReportId;
        if (!string.IsNullOrEmpty(id))
        {
            try
            {
                Process.Start(new ProcessStartInfo($"https://sentinelapp.io/r/{id}") { UseShellExecute = true });
            }
            catch { }
        }
        else
        {
            MessageBox.Show("No reports have been generated yet.", "Sentinel Agent", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    private void Pause_Click(object? sender, EventArgs e)
    {
        var paused = !RegistryState.Paused;
        RegistryState.Paused = paused;
        _pauseMenuItem.Checked = paused;
    }

    private void Uninstall_Click(object? sender, EventArgs e)
    {
        // For a real MSI, you'd trigger msiexec /x {ProductCode}
        MessageBox.Show("To uninstall Sentinel, please use 'Add or Remove Programs' in Windows Settings.", "Uninstall Sentinel", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            _contextMenu.Dispose();
        }
        base.Dispose(disposing);
    }
}
