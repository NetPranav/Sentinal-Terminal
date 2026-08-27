import { describe, it, expect } from 'vitest';
import { ApplicationCapability } from '../ApplicationCapability';
import { BluetoothCapability } from '../BluetoothCapability';
import { WifiCapability } from '../WifiCapability';
import { SystemSDKCapability } from '../SystemSDKCapability';

describe('Linux SDK Capability Drivers', () => {
  it('should support Linux platform in ApplicationCapability', async () => {
    const driver = new ApplicationCapability();
    expect(driver.supportedPlatforms).toContain('linux');

    const listRes = await driver.execute({ operation: 'list_running' }, { platform: 'linux' });
    expect(listRes.success).toBe(true);
    expect(listRes.data.apps).toBeDefined();
    expect(Array.isArray(listRes.data.apps)).toBe(true);

    const openRes = await driver.execute({ operation: 'open', app: 'Visual Studio Code', path: '~/Projects' }, { platform: 'linux' });
    expect(openRes.success).toBe(true);
  });

  it('should support Linux platform in BluetoothCapability', async () => {
    const driver = new BluetoothCapability();
    expect(driver.supportedPlatforms).toContain('linux');

    const listRes = await driver.execute({ operation: 'list' }, { platform: 'linux' });
    expect(listRes.success).toBe(true);

    const powerRes = await driver.execute({ operation: 'on' }, { platform: 'linux' });
    expect(powerRes.success).toBe(true);
    expect(powerRes.data.power).toBe('on');
  });

  it('should support Linux platform in WifiCapability', async () => {
    const driver = new WifiCapability();
    expect(driver.supportedPlatforms).toContain('linux');

    const scanRes = await driver.execute({ operation: 'scan' }, { platform: 'linux' });
    expect(scanRes.success).toBe(true);
    expect(scanRes.data.networks).toBeDefined();

    const onRes = await driver.execute({ operation: 'on' }, { platform: 'linux' });
    expect(onRes.success).toBe(true);
    expect(onRes.data.power).toBe('on');
  });

  it('should support Linux platform in SystemSDKCapability', async () => {
    const driver = new SystemSDKCapability();
    expect(driver.supportedPlatforms).toContain('linux');

    const infoRes = await driver.execute({ operation: 'info' }, { platform: 'linux' });
    expect(infoRes.success).toBe(true);

    const lockRes = await driver.execute({ operation: 'lock' }, { platform: 'linux' });
    expect(lockRes.success).toBe(true);
    expect(lockRes.data.locked).toBe(true);
  });
});
