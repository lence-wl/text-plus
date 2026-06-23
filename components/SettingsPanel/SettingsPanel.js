Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '设置'
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    }
  }
});
