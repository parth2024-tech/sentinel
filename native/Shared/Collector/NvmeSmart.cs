using System;
using System.Runtime.InteropServices;

namespace Sentinel.Shared;

public class NvmeSmart {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);
    
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool DeviceIoControl(IntPtr hDevice, uint dwIoControlCode, IntPtr lpInBuffer, uint nInBufferSize, IntPtr lpOutBuffer, uint nOutBufferSize, out uint lpBytesReturned, IntPtr lpOverlapped);
    
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    public class SmartData {
        public int PercentageUsed;
        public int AvailableSpare;
        public int AvailableSpareThreshold;
        public int CriticalWarning;
    }

    public static SmartData? GetSmartInfo(int physicalDriveNumber) {
        IntPtr hDevice = CreateFile("\\\\.\\PhysicalDrive" + physicalDriveNumber, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (hDevice == new IntPtr(-1)) return null;
        
        try {
            int bufferSize = 1024;
            IntPtr buffer = Marshal.AllocHGlobal(bufferSize);
            try {
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
                    IntPtr logPagePtr = IntPtr.Add(buffer, 40);
                    SmartData data = new SmartData();
                    data.CriticalWarning = Marshal.ReadByte(logPagePtr, 0);
                    data.AvailableSpare = Marshal.ReadByte(logPagePtr, 3);
                    data.AvailableSpareThreshold = Marshal.ReadByte(logPagePtr, 4);
                    data.PercentageUsed = Marshal.ReadByte(logPagePtr, 5);
                    return data;
                }
                return null;
            } finally {
                Marshal.FreeHGlobal(buffer);
            }
        } finally {
            CloseHandle(hDevice);
        }
    }
}
