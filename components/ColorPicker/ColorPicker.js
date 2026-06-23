Component({
  properties: {
    colorList: {
      type: Array,
      value: ['#FF0000', '#FFA500', '#00D26A']
    }
  },

  data: {
		color36List: [
			// 最常用彩色放前面
			{ value: '#FF0000', label: '大红色' },
			{ value: '#FF7D00', label: '橘红色' },
			{ value: '#FFA500', label: '橙色' },
			{ value: '#FFD300', label: '金黄色' },
			{ value: '#FFFF00', label: '柠檬黄' },
			{ value: '#00FF00', label: '草绿色' },
			{ value: '#00D26A', label: '翠绿色' },
			{ value: '#009E5F', label: '深绿色' },
			{ value: '#00BFFF', label: '天蓝色' },
			{ value: '#0080FF', label: '湖蓝色' },
			{ value: '#0050FF', label: '宝蓝色' },
			{ value: '#0000FF', label: '深蓝色' },
			{ value: '#FF69B4', label: '桃红色' },
			{ value: '#FF1493', label: '玫红色' },
			{ value: '#FFC0CB', label: '粉色' },
			{ value: '#D2B48C', label: '卡其色' },
			{ value: '#A0522D', label: '土黄色' },
			{ value: '#8B4513', label: '咖啡色' },
			{ value: '#C0C0C0', label: '浅灰色' },
			{ value: '#808080', label: '中灰色' },
			{ value: '#444444', label: '深灰色' },
			{ value: '#4B0082', label: '藏青色' },
			{ value: '#8A2BE2', label: '紫罗兰' },
			{ value: '#9932CC', label: '深紫色' },
			{ value: '#D870DB', label: '淡紫色' },
			{ value: '#DC143C', label: '酒红色' },
			{ value: '#B22222', label: '暗红色' },
			{ value: '#CD5C5C', label: '浅赤色' },
			{ value: '#F08080', label: '浅红色' },
			{ value: '#DEB887', label: '浅棕色' },
			{ value: '#5D2906', label: '深棕色' },
			{ value: '#008060', label: '墨绿色' },
			{ value: '#C1FF00', label: '嫩黄绿' },
			{ value: '#E6E6FA', label: '奶白色' },
		
			// 黑色 倒数第二
			{ value: '#000000', label: '黑色' },
		
			// 白色 最后一个
			{ value: '#FFFFFF', label: '白色' },
		],
    currentIndex: null,
    show: false
  },

  lifetimes: {
    attached() {
      this.syncCheckState()
    }
  },

  observers: {
    colorList() {
      this.syncCheckState()
    }
  },

  methods: {
    syncCheckState() {
      const list = this.properties.colorList
      this.setData({
        color36List: this.data.color36List.map(c => ({
          ...c,
          checked: list.includes(c.value)
        }))
      })
    },

    tapHandle(e) {
      const index = e.currentTarget.dataset.index
      this.setData({ show: true, currentIndex: index })
    },

    handleClose() {
      this.setData({ show: false })
    },

    handleColorSelect(e) {
      const color = e.currentTarget.dataset.color
      const idx = this.data.currentIndex
      if (idx == null) return

      let colorList = this.properties.colorList.reduce((res,c) =>{
				res.push(c)
				return res;
			},[])
      colorList[idx] = color
      this.triggerEvent('colorChange', { colorList })
      this.setData({ colorList })
    }
  }
})