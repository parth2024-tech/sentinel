Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class Nvme {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);
    
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool DeviceIoControl(IntPtr hDevice, uint dwIoControlCode, IntPtr lpInBuffer, uint nInBufferSize, IntPtr lpOutBuffer, uint nOutBufferSize, out uint lpBytesReturned, IntPtr lpOverlapped);
    
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    public static int GetNvmeLifeLeft(int physicalDriveNumber) {
        IntPtr hDevice = CreateFile("\\\\.\\PhysicalDrive" + physicalDriveNumber, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (hDevice == new IntPtr(-1)) return -1;
        
        try {
            int bufferSize = 1024;
            IntPtr buffer = Marshal.AllocHGlobal(bufferSize);
            for(int i=0; i<bufferSize; i++) Marshal.WriteByte(buffer, i, 0);
            
            Marshal.WriteInt32(buffer, 0, 49);
            Marshal.WriteInt32(buffer, 4, 0);
            
            Marshal.WriteInt32(buffer, 12, 3);
            Marshal.WriteInt32(buffer, 16, 2);
            Marshal.WriteInt32(buffer, 20, 2);
            Marshal.WriteInt32(buffer, 24, 0);
            Marshal.WriteInt32(buffer, 28, 40);
            Marshal.WriteInt32(buffer, 32, 512);
            
            uint bytesReturned;
            bool success = DeviceIoControl(hDevice, 0x2D1400, buffer, 52, buffer, (uint)bufferSize, out bytesReturned, IntPtr.Zero);
            
            if (success) {
                IntPtr logPagePtr = new IntPtr(buffer.ToInt64() + 40);
                byte percentageUsed = Marshal.ReadByte(logPagePtr, 5);
                Marshal.FreeHGlobal(buffer);
                return percentageUsed > 100 ? 0 : 100 - percentageUsed;
            }
            Marshal.FreeHGlobal(buffer);
            return -1;
        } finally {
            CloseHandle(hDevice);
        }
    }
}
"@
[Nvme]::GetNvmeLifeLeft(0)
