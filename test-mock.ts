class MockCapability {
  constructor(public id: string, public name: string) {}
  metadata = { id: this.id, name: this.name };
}
console.log(new MockCapability("test", "test").metadata);
